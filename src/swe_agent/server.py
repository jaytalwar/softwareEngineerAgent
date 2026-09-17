"""FastAPI bridge exposing the multi-agent graph over HTTP + SSE.

Wraps `build_agent_graph` + `Budget` + `Tracer` behind a small REST API a
web UI can drive: create a task, list tasks, fetch one, and stream its
trace events live over Server-Sent Events.

`GraphEngine.run()` is synchronous and can take a while (real tool calls,
real LLM round-trips), so each task runs in a worker thread; the SSE
endpoint tails that task's own `traces/<id>.jsonl` file to observe
progress — this is exactly what the tracing infrastructure (step 5/6 of
BUILD_LOG) was built for, not a parallel notification mechanism bolted on
top of it.

This is a local development bridge, not a hardened multi-user service:
there's no auth, and concurrent reads of a task's `TaskState` while its
worker thread mutates it are not lock-protected (acceptable for one local
user driving one browser tab; see BUILD_LOG for the honest caveats). Task
*history* does survive a restart, though — each task is written to
`tasks/<id>.json` on creation and again once it reaches a terminal status,
and reloaded into `_TASKS` at startup (see `_load_tasks_from_disk`).
"""

import asyncio
import json
import os
import shutil
import tempfile
import threading
import uuid
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from swe_agent.agents.graph import build_agent_graph
from swe_agent.agents.scripted_fallback_llm import ScriptedFallbackLLMClient
from swe_agent.llm import DEFAULT_MODEL, AnthropicLLMClient, LLMClient
from swe_agent.orchestrator.engine import (
    Budget,
    BudgetExceededError,
    GraphExecutionError,
    TaskCancelledError,
)
from swe_agent.schemas import AgentMessage, TaskState
from swe_agent.trace import Tracer

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_DEMO_REPO_TEMPLATE = _PROJECT_ROOT / "sandbox_fixtures"
_TRACE_DIR = _PROJECT_ROOT / "traces"
_TASKS_DIR = _PROJECT_ROOT / "tasks"

AVAILABLE_MODELS = [
    "claude-sonnet-5",
    "claude-opus-5",
    "claude-haiku-4-5-20251001",
    "claude-fable-5-1",
]

DEFAULT_MAX_ITERATIONS = 20

# Session-only settings, held in memory: an API key entered here overrides
# $ANTHROPIC_API_KEY for the lifetime of this process, is never written to
# disk or echoed back in any response, and is lost on restart. Traffic
# between the UI and this bridge never leaves loopback, so plain HTTP here
# carries the same exposure as any other local dev server.
_SETTINGS: dict[str, Any] = {
    "api_key": None,
    "model": DEFAULT_MODEL,
    "max_iterations": DEFAULT_MAX_ITERATIONS,
}


@dataclass
class TaskRecord:
    state: TaskState
    title: str
    repo_root: Path
    llm_mode: str
    max_iterations: int
    error: str | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)


class _PersistedRecord(BaseModel):
    """The on-disk shape of a `TaskRecord` — everything except
    `cancel_event`, which isn't serializable and is meaningless after a
    restart anyway: no worker thread survives to be cancelled."""

    state: TaskState
    title: str
    repo_root: str
    llm_mode: str
    max_iterations: int
    error: str | None = None


_TASKS: dict[str, TaskRecord] = {}
_EXECUTOR = ThreadPoolExecutor(max_workers=4)


class CreateTaskRequest(BaseModel):
    title: str
    repo_root: str | None = None
    max_iterations: int | None = None


class TaskSummary(BaseModel):
    task_id: str
    title: str
    status: str
    llm_mode: str
    max_iterations: int
    repo_root: str


class RepoValidateRequest(BaseModel):
    path: str


class RepoValidateResponse(BaseModel):
    valid: bool
    name: str | None = None
    is_git_repo: bool = False
    error: str | None = None


class SettingsUpdate(BaseModel):
    """`api_key`: omit to leave unchanged, `""` to clear it, a value to set
    it. Never returned back in `SettingsView` — only whether one is set."""

    api_key: str | None = None
    model: str | None = None
    max_iterations: int | None = None


class SettingsView(BaseModel):
    has_api_key: bool
    model: str
    max_iterations: int
    available_models: list[str]


def create_app() -> FastAPI:
    app = FastAPI(title="swe-agent bridge")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "llm_mode": _llm_mode()}

    @app.post("/api/tasks", response_model=TaskSummary)
    def create_task(req: CreateTaskRequest) -> TaskSummary:
        if req.repo_root:
            repo_root = Path(req.repo_root).expanduser().resolve()
            if not repo_root.is_dir():
                raise HTTPException(400, f"repo_root does not exist: {repo_root}")
        else:
            repo_root = _fresh_demo_repo()

        max_iterations = (
            req.max_iterations if req.max_iterations is not None else _SETTINGS["max_iterations"]
        )
        task_id = uuid.uuid4().hex[:10]
        state = TaskState(
            task_id=task_id,
            messages=[AgentMessage(role="user", content=req.title)],
        )
        record = TaskRecord(
            state=state,
            title=req.title,
            repo_root=repo_root,
            llm_mode=_llm_mode(),
            max_iterations=max_iterations,
        )
        _TASKS[task_id] = record
        _save_task(record)

        budget = Budget(max_iterations=max_iterations)
        _EXECUTOR.submit(_run_task, task_id, budget)

        return _summary(record)

    @app.get("/api/tasks", response_model=list[TaskSummary])
    def list_tasks() -> list[TaskSummary]:
        records = sorted(_TASKS.values(), key=lambda r: r.state.created_at, reverse=True)
        return [_summary(r) for r in records]

    @app.get("/api/tasks/{task_id}")
    def get_task(task_id: str) -> TaskState:
        record = _TASKS.get(task_id)
        if record is None:
            raise HTTPException(404, "task not found")
        return record.state

    @app.get("/api/tasks/{task_id}/stream")
    async def stream_task(task_id: str) -> StreamingResponse:
        if task_id not in _TASKS:
            raise HTTPException(404, "task not found")
        return StreamingResponse(_tail_trace(task_id), media_type="text/event-stream")

    @app.post("/api/tasks/{task_id}/cancel", response_model=TaskSummary)
    def cancel_task(task_id: str) -> TaskSummary:
        record = _TASKS.get(task_id)
        if record is None:
            raise HTTPException(404, "task not found")
        if record.state.status not in _TERMINAL_STATUSES:
            record.cancel_event.set()
        return _summary(record)

    @app.get("/api/tasks/{task_id}/tree")
    def get_tree(task_id: str) -> dict[str, Any]:
        record = _TASKS.get(task_id)
        if record is None:
            raise HTTPException(404, "task not found")
        if not record.repo_root.is_dir():
            # Expected for an old task restored from disk (see
            # `_load_tasks_from_disk`) whose demo repo was a temp directory
            # the OS has since cleaned up — the rest of the task's history
            # (messages, tool results) is still intact, just not its tree.
            raise HTTPException(404, "this task's repo no longer exists on disk")
        return _build_tree(record.repo_root, record.repo_root)

    @app.post("/api/repos/validate", response_model=RepoValidateResponse)
    def validate_repo(body: RepoValidateRequest) -> RepoValidateResponse:
        raw = body.path.strip()
        if not raw:
            return RepoValidateResponse(valid=False, error="Enter a path.")
        path = Path(raw).expanduser().resolve()
        if not path.exists():
            return RepoValidateResponse(valid=False, error=f"No such path: {path}")
        if not path.is_dir():
            return RepoValidateResponse(
                valid=False, error="That path is a file, not a directory."
            )
        return RepoValidateResponse(
            valid=True, name=path.name, is_git_repo=(path / ".git").exists()
        )

    @app.get("/api/settings", response_model=SettingsView)
    def get_settings() -> SettingsView:
        return _settings_view()

    @app.post("/api/settings", response_model=SettingsView)
    def update_settings(body: SettingsUpdate) -> SettingsView:
        if body.api_key is not None:
            _SETTINGS["api_key"] = body.api_key or None
        if body.model is not None:
            if body.model not in AVAILABLE_MODELS:
                raise HTTPException(400, f"unknown model: {body.model!r}")
            _SETTINGS["model"] = body.model
        if body.max_iterations is not None:
            if body.max_iterations < 1:
                raise HTTPException(400, "max_iterations must be at least 1")
            _SETTINGS["max_iterations"] = body.max_iterations
        return _settings_view()

    return app


def _settings_view() -> SettingsView:
    return SettingsView(
        has_api_key=bool(_effective_api_key()),
        model=_SETTINGS["model"],
        max_iterations=_SETTINGS["max_iterations"],
        available_models=AVAILABLE_MODELS,
    )


def _effective_api_key() -> str | None:
    return _SETTINGS["api_key"] or os.environ.get("ANTHROPIC_API_KEY")


def _llm_mode() -> str:
    return "anthropic" if _effective_api_key() else "scripted-fallback"


def _make_llm() -> LLMClient:
    api_key = _effective_api_key()
    if api_key:
        return AnthropicLLMClient(model=_SETTINGS["model"], api_key=api_key)
    return ScriptedFallbackLLMClient()


def _fresh_demo_repo() -> Path:
    dest = Path(tempfile.mkdtemp(prefix="swe-agent-run-"))
    shutil.copytree(_DEMO_REPO_TEMPLATE, dest, dirs_exist_ok=True)
    return dest


_TREE_SKIP_DIRS = {
    ".git",
    "__pycache__",
    ".venv",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    "node_modules",
}


def _build_tree(root: Path, current: Path) -> dict[str, Any]:
    """Recursively walk `current` (within `root`) into the frontend's
    `RepoNode` shape: `{type, name, path, children?}`. Matches
    `web/src/lib/types.ts`'s `RepoNode` exactly — no DTO layer needed."""
    rel_path = "" if current == root else str(current.relative_to(root))
    name = root.name if current == root else current.name

    if current.is_dir():
        children = [
            _build_tree(root, child)
            for child in sorted(current.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            if child.name not in _TREE_SKIP_DIRS
        ]
        return {"type": "dir", "name": name, "path": rel_path, "children": children}

    return {"type": "file", "name": name, "path": rel_path}


def _summary(record: TaskRecord) -> TaskSummary:
    return TaskSummary(
        task_id=record.state.task_id,
        title=record.title,
        status=record.state.status,
        llm_mode=record.llm_mode,
        max_iterations=record.max_iterations,
        repo_root=str(record.repo_root),
    )


_TERMINAL_STATUSES = ("succeeded", "failed", "cancelled")


def _task_path(task_id: str) -> Path:
    return _TASKS_DIR / f"{task_id}.json"


def _save_task(record: TaskRecord) -> None:
    _TASKS_DIR.mkdir(parents=True, exist_ok=True)
    persisted = _PersistedRecord(
        state=record.state,
        title=record.title,
        repo_root=str(record.repo_root),
        llm_mode=record.llm_mode,
        max_iterations=record.max_iterations,
        error=record.error,
    )
    _task_path(record.state.task_id).write_text(persisted.model_dump_json())


def _load_tasks_from_disk() -> None:
    """Restores task history across a server restart. A task that was
    still `pending`/`running` when the process died has no worker thread
    left to resume — it's rewritten here as `failed` instead of hanging
    forever as a fake "in progress" in the UI."""
    if not _TASKS_DIR.exists():
        return
    for path in sorted(_TASKS_DIR.glob("*.json")):
        try:
            persisted = _PersistedRecord.model_validate_json(path.read_text())
        except (ValueError, OSError):
            continue  # corrupted/partially-written file — skip it, don't crash startup
        record = TaskRecord(
            state=persisted.state,
            title=persisted.title,
            repo_root=Path(persisted.repo_root),
            llm_mode=persisted.llm_mode,
            max_iterations=persisted.max_iterations,
            error=persisted.error,
        )
        if record.state.status in ("pending", "running"):
            record.state.status = "failed"
            record.error = "Interrupted by a server restart."
            _save_task(record)
        _TASKS[record.state.task_id] = record


def _run_task(task_id: str, budget: Budget) -> None:
    record = _TASKS[task_id]
    tracer = Tracer(task_id, trace_dir=_TRACE_DIR)
    llm = _make_llm()
    engine = build_agent_graph(llm, record.repo_root, tracer=tracer)
    try:
        engine.run(
            record.state,
            budget=budget,
            tracer=tracer,
            cancel_requested=record.cancel_event.is_set,
        )
    except TaskCancelledError as exc:
        exc.state.status = "cancelled"
    except BudgetExceededError as exc:
        exc.state.status = "failed"
        record.error = str(exc)
    except GraphExecutionError as exc:
        record.state.status = "failed"
        record.error = str(exc)
    except Exception as exc:  # noqa: BLE001 - surface any crash to the UI instead of hanging it
        record.state.status = "failed"
        record.error = f"{type(exc).__name__}: {exc}"
    finally:
        _save_task(record)


async def _tail_trace(task_id: str) -> AsyncIterator[bytes]:
    path = _TRACE_DIR / f"{task_id}.jsonl"
    seen = 0
    while True:
        record = _TASKS.get(task_id)
        if path.exists():
            lines = path.read_text().splitlines()
            for line in lines[seen:]:
                yield f"data: {line}\n\n".encode()
            seen = len(lines)

        if record is None or record.state.status in _TERMINAL_STATUSES:
            payload = json.dumps(
                {
                    "status": record.state.status if record else "unknown",
                    "error": record.error if record else None,
                }
            )
            yield f"event: done\ndata: {payload}\n\n".encode()
            return

        await asyncio.sleep(0.3)


app = create_app()


if __name__ == "__main__":
    import uvicorn

    # Deliberately not inside `create_app()` or at module scope: this must
    # only run for the actual dev server process, never on `import
    # swe_agent.server` (which is all `TestClient(create_app())` does in
    # tests) — otherwise every test run would load, and get polluted by,
    # this machine's real `tasks/` history.
    _load_tasks_from_disk()

    uvicorn.run(app, host="127.0.0.1", port=8000)
