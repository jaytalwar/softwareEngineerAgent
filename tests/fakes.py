"""Test doubles shared across the test suite."""

from dataclasses import dataclass, field
from typing import Any

from swe_agent.llm import LLMResponse, ToolUse


@dataclass
class FakeLLMClient:
    """Returns a scripted sequence of `LLMResponse`s; records every call made.

    Structurally satisfies `swe_agent.llm.LLMClient` — no real API key or
    network access needed.
    """

    responses: list[LLMResponse]
    calls: list[dict[str, Any]] = field(default_factory=list)
    cost_per_call_usd: float = 0.0
    _index: int = field(default=0, init=False)

    def complete(
        self,
        *,
        system: str,
        messages: Any,
        tools: Any = None,
    ) -> LLMResponse:
        self.calls.append({"system": system, "messages": list(messages), "tools": tools})
        response = self.responses[self._index]
        self._index += 1
        return response

    def cost_usd(self, *, input_tokens: int, output_tokens: int) -> float:
        return self.cost_per_call_usd


def text_response(
    text: str, *, input_tokens: int = 10, output_tokens: int = 10, stop_reason: str = "end_turn"
) -> LLMResponse:
    return LLMResponse(
        content_blocks=[{"type": "text", "text": text}],
        text=text,
        tool_uses=[],
        stop_reason=stop_reason,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


def tool_use_response(
    tool_name: str,
    arguments: dict[str, Any],
    *,
    tool_use_id: str = "tu_1",
    input_tokens: int = 10,
    output_tokens: int = 10,
) -> LLMResponse:
    return LLMResponse(
        content_blocks=[
            {"type": "tool_use", "id": tool_use_id, "name": tool_name, "input": arguments}
        ],
        text="",
        tool_uses=[ToolUse(id=tool_use_id, name=tool_name, arguments=arguments)],
        stop_reason="tool_use",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
