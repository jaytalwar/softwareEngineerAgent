import pytest

from fakes import FakeLLMClient, text_response
from swe_agent.agents.planner import make_planner_node
from swe_agent.schemas import AgentMessage, TaskState


def test_planner_appends_plan_and_updates_counters() -> None:
    llm = FakeLLMClient(
        responses=[text_response("1. Do X\n2. Do Y", input_tokens=20, output_tokens=30)],
        cost_per_call_usd=0.01,
    )
    node = make_planner_node(llm)
    state = TaskState(messages=[AgentMessage(role="user", content="Add a health-check endpoint")])

    result = node(state)

    assert result.messages[-1].role == "assistant"
    assert result.messages[-1].name == "planner"
    assert "Do X" in result.messages[-1].content
    assert result.iteration == 1
    assert result.total_tokens == 50
    assert result.total_cost_usd == pytest.approx(0.01)
    assert result.status == "running"


def test_planner_passes_task_description_to_the_llm() -> None:
    llm = FakeLLMClient(responses=[text_response("plan")])
    node = make_planner_node(llm)
    state = TaskState(messages=[AgentMessage(role="user", content="Add a health-check endpoint")])

    node(state)

    assert llm.calls[0]["messages"] == [{"role": "user", "content": "Add a health-check endpoint"}]
    assert "planning agent" in llm.calls[0]["system"]
