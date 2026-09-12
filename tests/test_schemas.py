from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from swe_agent.schemas import AgentMessage, TaskState, ToolCall, ToolResult


def test_agent_message_defaults_and_required_role() -> None:
    msg = AgentMessage(role="user", content="hello")

    assert msg.id
    assert msg.name is None
    assert msg.metadata == {}
    assert msg.created_at.tzinfo is not None


def test_agent_message_rejects_unknown_role() -> None:
    with pytest.raises(ValidationError):
        AgentMessage(role="bogus", content="hi")  # type: ignore[arg-type]


def test_agent_message_is_frozen() -> None:
    msg = AgentMessage(role="assistant", content="hi")

    with pytest.raises(ValidationError):
        msg.content = "changed"


def test_tool_call_defaults() -> None:
    call = ToolCall(tool_name="read_file", arguments={"path": "a.py"})

    assert call.id
    assert call.arguments == {"path": "a.py"}


def test_tool_result_latency_ms() -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    finish = start + timedelta(milliseconds=250)

    result = ToolResult(
        call_id="abc",
        tool_name="run_tests",
        success=True,
        output={"passed": 1},
        started_at=start,
        finished_at=finish,
    )

    assert result.latency_ms == pytest.approx(250.0)


def test_task_state_defaults() -> None:
    state = TaskState()

    assert state.status == "pending"
    assert state.iteration == 0
    assert state.messages == []
    assert state.pending_tool_calls == []
    assert state.tool_results == []


def test_task_state_rejects_unknown_status() -> None:
    with pytest.raises(ValidationError):
        TaskState(status="bogus")  # type: ignore[arg-type]


def test_task_state_accumulates_history() -> None:
    state = TaskState()
    state.messages.append(AgentMessage(role="user", content="do the thing"))
    state.iteration += 1
    state.status = "running"

    assert len(state.messages) == 1
    assert state.iteration == 1
    assert state.status == "running"
