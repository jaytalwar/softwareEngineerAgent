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

This is a local development bridge, not a hardened multi-user service: task
state lives in an in-process dict (lost on restart), there's no auth, and
concurrent reads of a task's `TaskState` while its worker thread mutates it
are not lock-protected (acceptable for one local user driving one browser
tab; see BUILD_LOG for the honest caveats).
"""

import asyncio
import json
import os
import shutil
import tempfile
import uuid
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from swe_agent.agents.graph import build_agent_graph
from swe_agent.agents.scripted_fallback_llm import ScriptedFallbackLLMClient
from swe_agent.llm import DEFAULT_MODEL, AnthropicLLMClient, LLMClient
from swe_agent.orchestrator.engine import Budget, BudgetExceededError, GraphExecutionError
from swe_agent.schemas import AgentMessage, TaskState
from swe_agent.trace import Tracer

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_DEMO_REPO_TEMPLATE = _PROJECT_ROOT / "sandbox_fixtures"
_TRACE_DIR = _PROJECT_ROOT / "traces"

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
            repo_root = Path(req.repo_root)
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

    @app.get("/api/tasks/{task_id}/tree")
    def get_tree(task_id: str) -> dict[str, Any]:
        record = _TASKS.get(task_id)
        if record is None:
            raise HTTPException(404, "task not found")
        return _build_tree(record.repo_root, record.repo_root)

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


def _run_task(task_id: str, budget: Budget) -> None:
    record = _TASKS[task_id]
    tracer = Tracer(task_id, trace_dir=_TRACE_DIR)
    llm = _make_llm()
    engine = build_agent_graph(llm, record.repo_root, tracer=tracer)
    try:
        engine.run(record.state, budget=budget, tracer=tracer)
    except BudgetExceededError as exc:
        exc.state.status = "failed"
        record.error = str(exc)
    except GraphExecutionError as exc:
        record.state.status = "failed"
        record.error = str(exc)
    except Exception as exc:  # noqa: BLE001 - surface any crash to the UI instead of hanging it
        record.state.status = "failed"
        record.error = f"{type(exc).__name__}: {exc}"


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

        if record is None or record.state.status in ("succeeded", "failed", "cancelled"):
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

    uvicorn.run(app, host="127.0.0.1", port=8000)
