import json
from pathlib import Path

from fakes import FakeLLMClient, text_response, tool_use_response
from swe_agent.agents.coder import make_coder_node
from swe_agent.schemas import AgentMessage, TaskState
from swe_agent.trace import Tracer


def test_coder_executes_a_tool_call_then_finishes(sandbox_copy: Path) -> None:
    llm = FakeLLMClient(
        responses=[
            tool_use_response(
                "write_file", {"path": "notes.txt", "content": "hi\n"}, tool_use_id="tu_1"
            ),
            text_response("Wrote notes.txt with a greeting."),
        ]
    )
    node = make_coder_node(llm, sandbox_copy)
    state = TaskState(messages=[AgentMessage(role="user", content="Write hi to notes.txt")])

    result = node(state)

    assert (sandbox_copy / "notes.txt").read_text() == "hi\n"
    assert result.messages[-1].role == "assistant"
    assert result.messages[-1].name == "coder"
    assert result.messages[-1].content == "Wrote notes.txt with a greeting."
    assert len(result.tool_results) == 1
    assert result.tool_results[0].tool_name == "write_file"
    assert result.tool_results[0].success is True
    assert result.iteration == 1
    assert len(llm.calls) == 2


def test_coder_feeds_tool_errors_back_to_the_model_and_recovers(sandbox_copy: Path) -> None:
    llm = FakeLLMClient(
        responses=[
            tool_use_response("read_file", {"path": "nope.py"}, tool_use_id="tu_1"),
            text_response("That file doesn't exist; nothing more to do."),
        ]
    )
    node = make_coder_node(llm, sandbox_copy)
    state = TaskState(messages=[AgentMessage(role="user", content="Read nope.py")])

    result = node(state)

    assert result.tool_results[0].success is False
    assert "no such file" in (result.tool_results[0].error or "")
    # the error was fed back into the conversation as a tool_result block
    second_call_messages = llm.calls[1]["messages"]
    tool_result_block = second_call_messages[-1]["content"][0]
    assert tool_result_block["is_error"] is True
    assert "no such file" in tool_result_block["content"]


def test_coder_records_a_tool_level_trace_event_per_call(
    sandbox_copy: Path, tmp_path: Path
) -> None:
    llm = FakeLLMClient(
        responses=[
            tool_use_response(
                "write_file", {"path": "notes.txt", "content": "hi\n"}, tool_use_id="tu_1"
            ),
            text_response("Done."),
        ]
    )
    tracer = Tracer("coder-trace-test", trace_dir=tmp_path)
    node = make_coder_node(llm, sandbox_copy, tracer=tracer)
    state = TaskState(messages=[AgentMessage(role="user", content="Write hi to notes.txt")])

    node(state)

    lines = [json.loads(line) for line in tracer.path.read_text().splitlines()]
    assert len(lines) == 1
    assert lines[0]["kind"] == "tool"
    assert lines[0]["name"] == "write_file"
    assert lines[0]["error"] is None


def test_coder_stops_after_max_tool_iterations(sandbox_copy: Path) -> None:
    responses = [
        tool_use_response("list_dir", {}, tool_use_id=f"tu_{i}") for i in range(5)
    ]
    llm = FakeLLMClient(responses=responses)
    node = make_coder_node(llm, sandbox_copy, max_tool_iterations=3)
    state = TaskState(messages=[AgentMessage(role="user", content="loop forever")])

    result = node(state)

    assert len(llm.calls) == 3
    assert "exceeded" in result.messages[-1].content
