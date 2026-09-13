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

REVIEWER_SYSTEM_PROMPT = (
    "You are the reviewing agent in a multi-agent software engineering system. "
    "You are given the test suite and linter output after the Coder's latest "
    "attempt, which did not fully pass. Write a short, concrete, actionable "
    "note telling the Coder exactly what to fix next."
)


def make_reviewer_node(llm: LLMClient, repo_root: Path) -> NodeFunc:
    def reviewer(state: TaskState) -> TaskState:
        state.iteration += 1
        test_result = _run_tests(repo_root, state)

        if test_result["failed"] == 0 and test_result["errors"] == 0:
            state.status = "succeeded"
            state.messages.append(
                AgentMessage(role="user", name="reviewer", content="All tests pass. Accepted.")
            )
            return state

        lint_result = _run_lint(repo_root)
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


def _run_tests(repo_root: Path, state: TaskState) -> dict[str, Any]:
    started_at = utcnow()
    try:
        result: dict[str, Any] = execute_tool(repo_root, "run_tests", {})
        success = result["failed"] == 0 and result["errors"] == 0
        error = None
    except ToolError as exc:
        result = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "errors": 1,
            "failing_tests": [{"name": "run_tests", "message": str(exc)}],
        }
        success = False
        error = str(exc)
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


def _run_lint(repo_root: Path) -> list[dict[str, Any]]:
    try:
        result: list[dict[str, Any]] = execute_tool(repo_root, "get_lint_diagnostics", {})
        return result
    except ToolError:
        return []
