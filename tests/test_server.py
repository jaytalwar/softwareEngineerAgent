import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from swe_agent import server as server_module
from swe_agent.orchestrator.engine import Budget
from swe_agent.schemas import AgentMessage, TaskState
from swe_agent.server import create_app


@pytest.fixture(autouse=True)
def reset_settings() -> Any:
    # _SETTINGS is module-global (session-only settings, by design — see
    # server.py) — reset it around every test so one test's POST
    # /api/settings can't leak into the next.
    original = dict(server_module._SETTINGS)
    yield
    server_module._SETTINGS.clear()
    server_module._SETTINGS.update(original)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Force the deterministic scripted fallback: no network call, no API key
    # needed, and the test suite should never depend on either.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    return TestClient(create_app())


def _wait_for_terminal_status(client: TestClient, task_id: str) -> dict[str, Any]:
    state: dict[str, Any] = {}
    for _ in range(50):
        state = client.get(f"/api/tasks/{task_id}").json()
        if state["status"] in ("succeeded", "failed"):
            return state
        time.sleep(0.1)
    return state


def test_health_reports_scripted_fallback_without_an_api_key(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "llm_mode": "scripted-fallback"}


def test_create_task_runs_to_completion_against_a_throwaway_repo_copy(client: TestClient) -> None:
    create = client.post("/api/tasks", json={"title": "Fix the failing test"})

    assert create.status_code == 200
    body = create.json()
    assert body["llm_mode"] == "scripted-fallback"
    assert body["status"] == "pending"

    state = _wait_for_terminal_status(client, body["task_id"])

    assert state["status"] == "succeeded"
    names = [m["name"] for m in state["messages"]]
    assert names == [None, "planner", "coder", "reviewer"]


def test_get_unknown_task_returns_404(client: TestClient) -> None:
    response = client.get("/api/tasks/does-not-exist")

    assert response.status_code == 404


def test_create_task_rejects_a_nonexistent_repo_root(client: TestClient) -> None:
    response = client.post("/api/tasks", json={"title": "x", "repo_root": "/nope/nowhere"})

    assert response.status_code == 400


def test_list_tasks_includes_created_tasks(client: TestClient) -> None:
    task_id = client.post("/api/tasks", json={"title": "Listed task"}).json()["task_id"]

    response = client.get("/api/tasks")

    assert response.status_code == 200
    assert any(t["task_id"] == task_id for t in response.json())


def test_stream_endpoint_emits_tool_and_agent_events_then_a_done_event(client: TestClient) -> None:
    task_id = client.post("/api/tasks", json={"title": "Fix the failing test"}).json()["task_id"]

    body = ""
    with client.stream("GET", f"/api/tasks/{task_id}/stream") as response:
        assert response.status_code == 200
        for chunk in response.iter_text():
            body += chunk
            if "event: done" in body:
                break

    assert '"kind":"agent"' in body or '"kind": "agent"' in body
    assert '"kind":"tool"' in body or '"kind": "tool"' in body
    assert "event: done" in body


def test_stream_endpoint_404s_for_an_unknown_task(client: TestClient) -> None:
    response = client.get("/api/tasks/does-not-exist/stream")

    assert response.status_code == 404


def test_cancel_unknown_task_returns_404(client: TestClient) -> None:
    response = client.post("/api/tasks/does-not-exist/cancel")

    assert response.status_code == 404


def test_cancel_on_an_already_completed_task_is_a_no_op(client: TestClient) -> None:
    task_id = client.post("/api/tasks", json={"title": "Fix the failing test"}).json()["task_id"]
    _wait_for_terminal_status(client, task_id)

    response = client.post(f"/api/tasks/{task_id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"


def test_run_task_stops_early_and_marks_cancelled_when_requested(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Exercises server.py's own wiring (TaskRecord.cancel_event ->
    # _run_task -> engine.run(cancel_requested=...) -> status update)
    # directly, bypassing the HTTP + background-executor path used by the
    # other tests: cancelling *through* that path is a genuine race against
    # a graph that, on the scripted fallback, can finish in well under a
    # millisecond. Setting the event before `_run_task` is ever called
    # guarantees the cancellation is seen at the very first check point
    # (right after the planner node), deterministically.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    task_id = "cancel-test-task"
    state = TaskState(task_id=task_id, messages=[AgentMessage(role="user", content="Fix it")])
    record = server_module.TaskRecord(
        state=state,
        title="Fix it",
        repo_root=tmp_path,
        llm_mode="scripted-fallback",
        max_iterations=20,
    )
    record.cancel_event.set()
    server_module._TASKS[task_id] = record

    server_module._run_task(task_id, Budget(max_iterations=20))

    assert record.state.status == "cancelled"


def test_tree_endpoint_reflects_the_real_repo_root(client: TestClient) -> None:
    task_id = client.post("/api/tasks", json={"title": "Fix the failing test"}).json()["task_id"]

    response = client.get(f"/api/tasks/{task_id}/tree")

    assert response.status_code == 200
    tree = response.json()
    assert tree["type"] == "dir"
    assert tree["path"] == ""
    names = {child["name"] for child in tree["children"]}
    assert "tests" in names
    assert "math_utils.py" in names

    tests_dir = next(c for c in tree["children"] if c["name"] == "tests")
    test_names = {c["name"] for c in tests_dir["children"]}
    assert "test_math_utils.py" in test_names
    assert all(c["path"].startswith("tests/") for c in tests_dir["children"])


def test_tree_endpoint_404s_for_an_unknown_task(client: TestClient) -> None:
    response = client.get("/api/tasks/does-not-exist/tree")

    assert response.status_code == 404


def test_get_settings_reports_defaults_and_never_a_key_value(client: TestClient) -> None:
    response = client.get("/api/settings")

    assert response.status_code == 200
    body = response.json()
    assert body["has_api_key"] is False
    assert body["model"] == "claude-sonnet-5"
    assert body["max_iterations"] == 20
    assert "claude-sonnet-5" in body["available_models"]
    assert "api_key" not in body


def test_post_settings_updates_model_and_max_iterations(client: TestClient) -> None:
    response = client.post(
        "/api/settings", json={"model": "claude-opus-5", "max_iterations": 5}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "claude-opus-5"
    assert body["max_iterations"] == 5
    assert body["has_api_key"] is False


def test_post_settings_rejects_an_unknown_model(client: TestClient) -> None:
    response = client.post("/api/settings", json={"model": "not-a-real-model"})

    assert response.status_code == 400


def test_post_settings_rejects_a_non_positive_max_iterations(client: TestClient) -> None:
    response = client.post("/api/settings", json={"max_iterations": 0})

    assert response.status_code == 400


def test_post_settings_sets_and_clears_the_api_key_without_ever_returning_it(
    client: TestClient,
) -> None:
    set_response = client.post("/api/settings", json={"api_key": "sk-test-key"})
    assert set_response.json()["has_api_key"] is True
    assert "sk-test-key" not in set_response.text

    health = client.get("/api/health").json()
    assert health["llm_mode"] == "anthropic"

    clear_response = client.post("/api/settings", json={"api_key": ""})
    assert clear_response.json()["has_api_key"] is False
    assert client.get("/api/health").json()["llm_mode"] == "scripted-fallback"


def test_new_tasks_use_the_configured_default_max_iterations(client: TestClient) -> None:
    client.post("/api/settings", json={"max_iterations": 7})

    task = client.post("/api/tasks", json={"title": "Fix the failing test"}).json()

    assert task["max_iterations"] == 7


def test_task_level_max_iterations_overrides_the_configured_default(client: TestClient) -> None:
    client.post("/api/settings", json={"max_iterations": 7})

    task = client.post(
        "/api/tasks", json={"title": "Fix the failing test", "max_iterations": 3}
    ).json()

    assert task["max_iterations"] == 3


def test_validate_repo_accepts_a_real_directory(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()

    response = client.post("/api/repos/validate", json={"path": str(tmp_path)})

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["name"] == tmp_path.name
    assert body["is_git_repo"] is True


def test_validate_repo_reports_a_non_git_directory(client: TestClient, tmp_path: Path) -> None:
    response = client.post("/api/repos/validate", json={"path": str(tmp_path)})

    assert response.json()["is_git_repo"] is False


def test_validate_repo_rejects_a_missing_path(client: TestClient, tmp_path: Path) -> None:
    response = client.post("/api/repos/validate", json={"path": str(tmp_path / "nope")})

    body = response.json()
    assert body["valid"] is False
    assert body["error"]


def test_validate_repo_rejects_a_file(client: TestClient, tmp_path: Path) -> None:
    file_path = tmp_path / "not-a-dir.txt"
    file_path.write_text("hi")

    response = client.post("/api/repos/validate", json={"path": str(file_path)})

    assert response.json()["valid"] is False


def test_validate_repo_rejects_an_empty_path(client: TestClient) -> None:
    response = client.post("/api/repos/validate", json={"path": "  "})

    assert response.json()["valid"] is False


def test_create_task_accepts_a_real_repo_root(client: TestClient, tmp_path: Path) -> None:
    task = client.post(
        "/api/tasks", json={"title": "Fix the failing test", "repo_root": str(tmp_path)}
    ).json()

    assert task["repo_root"] == str(tmp_path.resolve())
