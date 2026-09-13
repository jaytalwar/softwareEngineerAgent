import pytest

from swe_agent.orchestrator.engine import END, GraphEngine, GraphExecutionError
from swe_agent.schemas import AgentMessage, TaskState


def _append(role: str, content: str) -> object:
    def node(state: TaskState) -> TaskState:
        state.messages.append(AgentMessage(role=role, content=content))  # type: ignore[arg-type]
        return state

    return node


def test_linear_pipeline_runs_nodes_in_order() -> None:
    engine = GraphEngine()
    engine.add_node("a", _append("assistant", "a"))  # type: ignore[arg-type]
    engine.add_node("b", _append("assistant", "b"))  # type: ignore[arg-type]
    engine.set_entry_point("a")
    engine.add_edge("a", "b")
    engine.add_edge("b", END)

    result = engine.run(TaskState())

    assert [m.content for m in result.messages] == ["a", "b"]


def test_conditional_edges_branch_on_state() -> None:
    def classify(state: TaskState) -> TaskState:
        state.status = "succeeded" if state.iteration > 0 else "failed"
        return state

    def route(state: TaskState) -> str:
        return "ok" if state.status == "succeeded" else "bad"

    engine = GraphEngine()
    engine.add_node("classify", classify)
    engine.add_node("ok_path", _append("assistant", "ok"))  # type: ignore[arg-type]
    engine.add_node("bad_path", _append("assistant", "bad"))  # type: ignore[arg-type]
    engine.set_entry_point("classify")
    engine.add_conditional_edges("classify", route, {"ok": "ok_path", "bad": "bad_path"})
    engine.add_edge("ok_path", END)
    engine.add_edge("bad_path", END)

    ok_result = engine.run(TaskState(iteration=1))
    bad_result = engine.run(TaskState(iteration=0))

    assert [m.content for m in ok_result.messages] == ["ok"]
    assert [m.content for m in bad_result.messages] == ["bad"]


def test_conditional_edge_supports_retry_cycle() -> None:
    """A node routes back to itself until a threshold, proving cycles work."""

    def attempt(state: TaskState) -> TaskState:
        state.iteration += 1
        if state.iteration >= 3:
            state.status = "succeeded"
        return state

    def route(state: TaskState) -> str:
        return "done" if state.status == "succeeded" else "retry"

    engine = GraphEngine()
    engine.add_node("attempt", attempt)
    engine.set_entry_point("attempt")
    engine.add_conditional_edges("attempt", route, {"retry": "attempt", "done": END})

    result = engine.run(TaskState())

    assert result.iteration == 3
    assert result.status == "succeeded"


def test_run_without_entry_point_raises() -> None:
    engine = GraphEngine()
    engine.add_node("a", _append("assistant", "a"))  # type: ignore[arg-type]

    with pytest.raises(GraphExecutionError, match="entry point"):
        engine.run(TaskState())


def test_node_with_no_outgoing_edge_raises() -> None:
    engine = GraphEngine()
    engine.add_node("a", _append("assistant", "a"))  # type: ignore[arg-type]
    engine.set_entry_point("a")

    with pytest.raises(GraphExecutionError, match="no outgoing edge"):
        engine.run(TaskState())


def test_conditional_edge_unrouted_key_raises() -> None:
    engine = GraphEngine()
    engine.add_node("a", lambda s: s)
    engine.set_entry_point("a")
    engine.add_conditional_edges("a", lambda s: "nowhere", {"somewhere": END})

    with pytest.raises(GraphExecutionError, match="unrouted key"):
        engine.run(TaskState())


def test_unbounded_cycle_is_stopped_by_max_steps() -> None:
    def spin(state: TaskState) -> TaskState:
        state.iteration += 1
        return state

    engine = GraphEngine()
    engine.add_node("spin", spin)
    engine.set_entry_point("spin")
    engine.add_edge("spin", "spin")

    with pytest.raises(GraphExecutionError, match="max_steps"):
        engine.run(TaskState(), max_steps=50)


def test_add_edge_from_unknown_node_raises() -> None:
    engine = GraphEngine()
    engine.add_node("a", lambda s: s)

    with pytest.raises(ValueError, match="unknown node"):
        engine.add_edge("a", "b")


def test_duplicate_outgoing_edge_raises() -> None:
    engine = GraphEngine()
    engine.add_node("a", lambda s: s)
    engine.add_node("b", lambda s: s)
    engine.add_edge("a", "b")

    with pytest.raises(ValueError, match="already has an outgoing edge"):
        engine.add_edge("a", END)
