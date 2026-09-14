"""The coding agent: uses the 10 tools to implement the plan."""

import json
from pathlib import Path
from typing import Any

from swe_agent.agents.common import to_anthropic_messages, utcnow
from swe_agent.agents.tool_registry import execute_tool, tool_definitions
from swe_agent.llm import LLMClient, ToolUse
from swe_agent.orchestrator.engine import NodeFunc
from swe_agent.schemas import AgentMessage, TaskState, ToolResult
from swe_agent.tools import ToolError
from swe_agent.trace import Tracer

CODER_SYSTEM_PROMPT = (
    "You are the coding agent in a multi-agent software engineering system. "
    "You have tools to read/write/edit files, run shell commands, run tests, "
    "check git diffs, apply patches, and check lint diagnostics. Use them to "
    "implement the plan. When you are done making changes, reply with a short "
    "summary of what you changed and stop calling tools."
)


def make_coder_node(
    llm: LLMClient,
    repo_root: Path,
    *,
    max_tool_iterations: int = 10,
    tracer: Tracer | None = None,
) -> NodeFunc:
    tools = tool_definitions(repo_root)

    def coder(state: TaskState) -> TaskState:
        state.iteration += 1
        conversation = to_anthropic_messages(state.messages)
        final_text = "(stopped: exceeded the per-turn tool-call loop limit)"

        for _ in range(max_tool_iterations):
            response = llm.complete(system=CODER_SYSTEM_PROMPT, messages=conversation, tools=tools)
            state.total_tokens += response.input_tokens + response.output_tokens
            state.total_cost_usd += llm.cost_usd(
                input_tokens=response.input_tokens, output_tokens=response.output_tokens
            )

            if not response.wants_tool_use:
                final_text = response.text
                break

            conversation.append({"role": "assistant", "content": response.content_blocks})
            tool_results = _run_tool_calls(repo_root, response.tool_uses, state, tracer)
            conversation.append({"role": "user", "content": tool_results})

        state.messages.append(AgentMessage(role="assistant", name="coder", content=final_text))
        return state

    return coder


def _run_tool_calls(
    repo_root: Path,
    tool_uses: list[ToolUse],
    state: TaskState,
    tracer: Tracer | None,
) -> list[dict[str, Any]]:
    tool_result_blocks: list[dict[str, Any]] = []
    for tool_use in tool_uses:
        if tracer is None:
            tool_result_blocks.append(_call_one_tool(repo_root, tool_use, state))
            continue
        with tracer.span(kind="tool", name=tool_use.name, input=tool_use.arguments) as span:
            block = _call_one_tool(repo_root, tool_use, state)
            span.output = block["content"]
            if block["is_error"]:
                span.error = block["content"]
        tool_result_blocks.append(block)
    return tool_result_blocks


def _call_one_tool(repo_root: Path, tool_use: ToolUse, state: TaskState) -> dict[str, Any]:
    started_at = utcnow()
    try:
        output = execute_tool(repo_root, tool_use.name, tool_use.arguments)
        content = output if isinstance(output, str) else json.dumps(output)
        success, error = True, None
    except ToolError as exc:
        content = f"Error: {exc}"
        success, error = False, str(exc)
    finished_at = utcnow()

    state.tool_results.append(
        ToolResult(
            call_id=tool_use.id,
            tool_name=tool_use.name,
            arguments=tool_use.arguments,
            success=success,
            output=content if success else None,
            error=error,
            started_at=started_at,
            finished_at=finished_at,
        )
    )
    return {
        "type": "tool_result",
        "tool_use_id": tool_use.id,
        "content": content,
        "is_error": not success,
    }
