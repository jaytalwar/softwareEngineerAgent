from pathlib import Path

import pytest

from fakes import FakeLLMClient, text_response, tool_use_response
from swe_agent.agents.graph import build_agent_graph
from swe_agent.orchestrator.engine import Budget, BudgetExceededError
from swe_agent.schemas import AgentMessage, TaskState


def test_agent_graph_reaches_success_after_one_retry(sandbox_copy: Path) -> None:
    llm = FakeLLMClient(
        responses=[
            text_response("Plan: fix the failing multiply test."),  # planner
            text_response("Looked around, nothing changed yet."),  # coder round 1 (no fix)
            text_response("multiply(2, 3) should be 6, not 999."),  # reviewer round 1 feedback
            tool_use_response(  # coder round 2: actually fix it
                "edit_file",
                {"path": "tests/test_math_utils.py", "old_str": "999", "new_str": "6"},
                tool_use_id="tu_1",
            ),
            text_response("Fixed the assertion in test_math_utils.py."),  # coder round 2 finish
        ]
    )
    engine = build_agent_graph(llm, sandbox_copy)
    state = TaskState(messages=[AgentMessage(role="user", content="Fix the failing test")])

    result = engine.run(state, budget=Budget(max_iterations=20))

    assert result.status == "succeeded"
    assert len(llm.calls) == 5
    assert result.iteration == 5  # planner, coder x2, reviewer x2
    names = [m.name for m in result.messages[1:]]  # skip the initial user task message
    assert names == ["planner", "coder", "reviewer", "coder", "reviewer"]
    assert "999" not in (sandbox_copy / "tests" / "test_math_utils.py").read_text()


def test_agent_graph_budget_stops_a_persistent_failure_loop(sandbox_copy: Path) -> None:
    llm = FakeLLMClient(
        responses=[
            text_response("plan"),  # planner
            text_response("attempt 1, no fix"),  # coder round 1
            text_response("feedback 1"),  # reviewer round 1 (tests still fail)
            text_response("attempt 2, still no fix"),  # coder round 2
        ]
    )
    engine = build_agent_graph(llm, sandbox_copy)
    state = TaskState(messages=[AgentMessage(role="user", content="Fix the failing test")])

    with pytest.raises(BudgetExceededError, match="max_iterations=3"):
        engine.run(state, budget=Budget(max_iterations=3))
