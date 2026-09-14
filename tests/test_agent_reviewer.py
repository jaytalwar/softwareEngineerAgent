import json
from pathlib import Path

from fakes import FakeLLMClient, text_response
from swe_agent.agents.reviewer import make_reviewer_node
from swe_agent.schemas import TaskState
from swe_agent.trace import Tracer


def _passing_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / "tests").mkdir(parents=True)
    (repo / "ok.py").write_text("def add(a: int, b: int) -> int:\n    return a + b\n")
    (repo / "tests" / "test_ok.py").write_text(
        "from ok import add\n\n\ndef test_add() -> None:\n    assert add(1, 2) == 3\n"
    )
    return repo


def test_reviewer_accepts_when_tests_pass_without_calling_the_llm(tmp_path: Path) -> None:
    repo = _passing_repo(tmp_path)
    llm = FakeLLMClient(responses=[])
    node = make_reviewer_node(llm, repo)
    state = TaskState()

    result = node(state)

    assert result.status == "succeeded"
    assert result.messages[-1].role == "user"
    assert result.messages[-1].name == "reviewer"
    assert "Accepted" in result.messages[-1].content
    assert llm.calls == []


def test_reviewer_requests_changes_when_tests_fail(sandbox: Path) -> None:
    llm = FakeLLMClient(responses=[text_response("Fix multiply(): it returns the wrong value.")])
    node = make_reviewer_node(llm, sandbox)
    state = TaskState()

    result = node(state)

    assert result.status != "succeeded"
    assert result.messages[-1].role == "user"
    assert result.messages[-1].name == "reviewer"
    assert "Fix multiply" in result.messages[-1].content
    assert len(llm.calls) == 1
    assert result.tool_results[-1].tool_name == "run_tests"
    assert result.tool_results[-1].success is False


def test_reviewer_records_a_run_tests_trace_event(sandbox: Path, tmp_path: Path) -> None:
    llm = FakeLLMClient(responses=[text_response("feedback")])
    tracer = Tracer("reviewer-trace-test", trace_dir=tmp_path)
    node = make_reviewer_node(llm, sandbox, tracer=tracer)
    state = TaskState()

    node(state)

    lines = [json.loads(line) for line in tracer.path.read_text().splitlines()]
    names = [line["name"] for line in lines]
    assert "run_tests" in names
    assert all(line["kind"] == "tool" for line in lines)


def test_reviewer_increments_iteration(sandbox: Path) -> None:
    llm = FakeLLMClient(responses=[text_response("feedback")])
    node = make_reviewer_node(llm, sandbox)
    state = TaskState(iteration=2)

    result = node(state)

    assert result.iteration == 3
