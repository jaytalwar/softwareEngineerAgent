"""LLM client abstraction so agent nodes are testable without real API calls.

`LLMClient` is a `Protocol` — `AnthropicLLMClient` wraps the real Anthropic
Messages API. Tests inject a scripted fake instead (see `tests/fakes.py`),
so nothing in the test suite ever makes a network call or needs an API key.
"""

import os
from collections.abc import Sequence
from typing import Any, Protocol

import anthropic
from pydantic import BaseModel

DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_MAX_TOKENS = 4096


class ToolUse(BaseModel):
    """One tool call the model asked to make."""

    id: str
    name: str
    arguments: dict[str, Any]


class LLMResponse(BaseModel):
    """One assistant turn, normalized away from the Anthropic SDK's own
    response types so the rest of the codebase (and test fakes) don't
    depend on them."""

    content_blocks: list[dict[str, Any]]
    text: str
    tool_uses: list[ToolUse] = []
    stop_reason: str
    input_tokens: int
    output_tokens: int

    @property
    def wants_tool_use(self) -> bool:
        return len(self.tool_uses) > 0


class LLMClient(Protocol):
    def complete(
        self,
        *,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]] | None = None,
    ) -> LLMResponse: ...

    def cost_usd(self, *, input_tokens: int, output_tokens: int) -> float: ...


class _MessagesAPI(Protocol):
    def create(self, **kwargs: Any) -> Any: ...


class _AnthropicClient(Protocol):
    """The slice of `anthropic.Anthropic` we actually use — lets tests
    inject a stub without constructing a real SDK client."""

    messages: _MessagesAPI


def _serialize_block(block: Any) -> dict[str, Any]:
    """Rebuild a minimal, clean request-shaped block from a response block.

    Deliberately doesn't use the SDK's own `.model_dump()`: response blocks
    carry extra fields (citations, caller, toolset_name, ...) that aren't
    part of the request-side block schema, and echoing them back risks the
    API rejecting the follow-up call.
    """
    if block.type == "text":
        return {"type": "text", "text": block.text}
    if block.type == "tool_use":
        return {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}
    return {"type": block.type}


class AnthropicLLMClient:
    """Wraps `anthropic.Anthropic().messages.create()`.

    Dollar-cost tracking is opt-in: pass real per-million-token prices if
    you want `cost_usd()` to mean anything. It's left at 0.0 by default,
    since hardcoding pricing for a model this far past this SDK's own
    training data would just be a guess.
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        *,
        client: _AnthropicClient | None = None,
        api_key: str | None = None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        input_price_per_mtok: float = 0.0,
        output_price_per_mtok: float = 0.0,
    ) -> None:
        self._client = client or anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )
        self._model = model
        self._max_tokens = max_tokens
        self._input_price_per_mtok = input_price_per_mtok
        self._output_price_per_mtok = output_price_per_mtok

    def complete(
        self,
        *,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]] | None = None,
    ) -> LLMResponse:
        kwargs: dict[str, Any] = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "system": system,
            "messages": list(messages),
        }
        if tools:
            kwargs["tools"] = list(tools)

        response = self._client.messages.create(**kwargs)

        text = "".join(block.text for block in response.content if block.type == "text")
        tool_uses = [
            ToolUse(id=block.id, name=block.name, arguments=dict(block.input))
            for block in response.content
            if block.type == "tool_use"
        ]
        return LLMResponse(
            content_blocks=[_serialize_block(block) for block in response.content],
            text=text,
            tool_uses=tool_uses,
            stop_reason=response.stop_reason or "end_turn",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

    def cost_usd(self, *, input_tokens: int, output_tokens: int) -> float:
        return (
            input_tokens * self._input_price_per_mtok / 1_000_000
            + output_tokens * self._output_price_per_mtok / 1_000_000
        )
