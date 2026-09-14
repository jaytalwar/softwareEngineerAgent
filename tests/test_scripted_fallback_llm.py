from swe_agent.agents.scripted_fallback_llm import ScriptedFallbackLLMClient


def test_planner_prompt_returns_a_plan() -> None:
    client = ScriptedFallbackLLMClient()

    response = client.complete(system="You are the planning agent...", messages=[])

    assert response.tool_uses == []
    assert "Plan" in response.text


def test_reviewer_prompt_returns_feedback() -> None:
    client = ScriptedFallbackLLMClient()

    response = client.complete(system="You are the reviewing agent...", messages=[])

    assert response.tool_uses == []
    assert response.text


def test_coder_first_call_edits_the_known_failing_test() -> None:
    client = ScriptedFallbackLLMClient()

    response = client.complete(system="You are the coding agent...", messages=[], tools=[{}])

    assert response.wants_tool_use is True
    assert response.tool_uses[0].name == "edit_file"
    assert response.tool_uses[0].arguments["old_str"] == "999"
    assert response.tool_uses[0].arguments["new_str"] == "6"


def test_coder_second_call_finishes_with_text() -> None:
    client = ScriptedFallbackLLMClient()
    client.complete(system="You are the coding agent...", messages=[], tools=[{}])

    response = client.complete(system="You are the coding agent...", messages=[], tools=[{}])

    assert response.wants_tool_use is False
    assert response.text


def test_cost_usd_is_always_zero() -> None:
    client = ScriptedFallbackLLMClient()

    assert client.cost_usd(input_tokens=1000, output_tokens=1000) == 0.0
