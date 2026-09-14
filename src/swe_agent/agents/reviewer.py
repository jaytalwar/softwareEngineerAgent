"""The reviewing agent: runs tests/lint and decides accept vs. retry.

Pass/fail is decided deterministically from the test suite, not by the
model — the LLM is only used to turn a failure into concrete, actionable
feedback for the Coder's next attempt (and isn't called at all when tests
already pass, to save a call).
"""

import json
from pathlib import Path
from typing import Any

from swe_agent.agents.common import utcnow
from swe_agent.agents.tool_registry import execute_tool
from swe_agent.llm import LLMClient
from swe_agent.orchestrator.engine import NodeFunc
from swe_agent.schemas import AgentMessage, TaskState, ToolResult
from swe_agent.tools import ToolError
from swe_agent.trace import Tracer

REVIEWER_SYSTEM_PROMPT = (
    "You are the reviewing agent in a multi-agent software engineering system. "
    "You are given the test suite and linter output after the Coder's latest "
    "attempt, which did not fully pass. Write a short, concrete, actionable "
    "note telling the Coder exactly what to fix next."
)


def make_reviewer_node(
    llm: LLMClient, repo_root: Path, *, tracer: Tracer | None = None
) -> NodeFunc:
    def reviewer(state: TaskState) -> TaskState:
        state.iteration += 1
        test_result = _run_tests(repo_root, state, tracer)

        if test_result["failed"] == 0 and test_result["errors"] == 0:
            state.status = "succeeded"
            state.messages.append(
                AgentMessage(role="user", name="reviewer", content="All tests pass. Accepted.")
            )
            return state

        lint_result = _run_lint(repo_root, tracer)
        response = llm.complete(
            system=REVIEWER_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Test results: {json.dumps(test_result)}\n"
                        f"Lint diagnostics: {json.dumps(lint_result)}"
                    ),
                }
            ],
        )
        state.total_tokens += response.input_tokens + response.output_tokens
        state.total_cost_usd += llm.cost_usd(
            input_tokens=response.input_tokens, output_tokens=response.output_tokens
        )
        state.messages.append(AgentMessage(role="user", name="reviewer", content=response.text))
        return state

    return reviewer


def _run_tests(repo_root: Path, state: TaskState, tracer: Tracer | None) -> dict[str, Any]:
    started_at = utcnow()
    if tracer is not None:
        with tracer.span(kind="tool", name="run_tests", input={}) as span:
            result, success, error = _call_run_tests(repo_root)
            span.output = result
            span.error = error
    else:
        result, success, error = _call_run_tests(repo_root)
    finished_at = utcnow()

    state.tool_results.append(
        ToolResult(
            call_id=f"reviewer-run_tests-{state.iteration}",
            tool_name="run_tests",
            success=success,
            output=result if success else None,
            error=error,
            started_at=started_at,
            finished_at=finished_at,
        )
    )
    return result


def _call_run_tests(repo_root: Path) -> tuple[dict[str, Any], bool, str | None]:
    try:
        result: dict[str, Any] = execute_tool(repo_root, "run_tests", {})
        return result, result["failed"] == 0 and result["errors"] == 0, None
    except ToolError as exc:
        result = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "errors": 1,
            "failing_tests": [{"name": "run_tests", "message": str(exc)}],
        }
        return result, False, str(exc)


def _run_lint(repo_root: Path, tracer: Tracer | None) -> list[dict[str, Any]]:
    if tracer is None:
        return _call_lint(repo_root)
    with tracer.span(kind="tool", name="get_lint_diagnostics", input={}) as span:
        result = _call_lint(repo_root)
        span.output = result
    return result


def _call_lint(repo_root: Path) -> list[dict[str, Any]]:
    try:
        result: list[dict[str, Any]] = execute_tool(repo_root, "get_lint_diagnostics", {})
        return result
    except ToolError:
        return []
