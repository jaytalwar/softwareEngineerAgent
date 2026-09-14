"""A deterministic, no-API-key LLM stand-in for demoing the real backend.

Used by the FastAPI bridge (`server.py`) when `ANTHROPIC_API_KEY` isn't
set, so the full real pipeline (GraphEngine, real tools, real Tracer, real
SSE) can be exercised end-to-end with no key and no API cost. It knows
about exactly one thing: the deliberately-wrong test assertion in
`sandbox_fixtures/tests/test_math_utils.py`, and fixes it — the same fix
already proven (against a fake client) in
`tests/test_agent_graph.py::test_agent_graph_reaches_success_after_one_retry`.

This is *not* a general-purpose agent: pointed at a different repo_root, it
will still apply this exact edit, which will simply fail or do nothing
useful there. It exists solely so the wiring can be demonstrated for real.
"""

from typing import Any

from swe_agent.llm import LLMResponse, ToolUse


class ScriptedFallbackLLMClient:
    def __init__(self) -> None:
        self._coder_calls = 0

    def complete(
        self,
        *,
        system: str,
        messages: Any,
        tools: Any = None,
    ) -> LLMResponse:
        if "planning agent" in system:
            return _text(
                "Plan: locate the failing test in the repository and correct its "
                "expected value."
            )
        if "reviewing agent" in system:
            return _text("The fix is minimal and scoped to the failing assertion.")

        self._coder_calls += 1
        if self._coder_calls == 1:
            return _tool_use(
                "edit_file",
                {"path": "tests/test_math_utils.py", "old_str": "999", "new_str": "6"},
            )
        return _text("Fixed the incorrect expected value in test_math_utils.py.")

    def cost_usd(self, *, input_tokens: int, output_tokens: int) -> float:
        return 0.0


def _text(text: str) -> LLMResponse:
    return LLMResponse(
        content_blocks=[{"type": "text", "text": text}],
        text=text,
        tool_uses=[],
        stop_reason="end_turn",
        input_tokens=40,
        output_tokens=20,
    )


def _tool_use(name: str, arguments: dict[str, Any]) -> LLMResponse:
    tool_use_id = f"scripted_{name}"
    return LLMResponse(
        content_blocks=[{"type": "tool_use", "id": tool_use_id, "name": name, "input": arguments}],
        text="",
        tool_uses=[ToolUse(id=tool_use_id, name=name, arguments=arguments)],
        stop_reason="tool_use",
        input_tokens=40,
        output_tokens=20,
    )
