import time
from typing import Any

import pytest
from fastapi.testclient import TestClient

from swe_agent.server import create_app


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
