from typing import Any

import pytest
from anthropic.types import Message, TextBlock, ToolUseBlock, Usage

from swe_agent.llm import AnthropicLLMClient, LLMResponse, ToolUse


class _StubMessagesAPI:
    def __init__(self, message: Message) -> None:
        self._message = message
        self.last_kwargs: dict[str, Any] | None = None

    def create(self, **kwargs: Any) -> Message:
        self.last_kwargs = kwargs
        return self._message


class _StubAnthropicClient:
    def __init__(self, message: Message) -> None:
        self.messages: Any = _StubMessagesAPI(message)


def _text_message(text: str, *, input_tokens: int = 10, output_tokens: int = 5) -> Message:
    return Message(
        id="msg_1",
        type="message",
        role="assistant",
        model="claude-sonnet-5",
        content=[TextBlock(type="text", text=text)],
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=input_tokens, output_tokens=output_tokens),
    )


def test_cost_usd_is_zero_by_default() -> None:
    client = AnthropicLLMClient(client=_StubAnthropicClient(_text_message("hi")))

    assert client.cost_usd(input_tokens=1_000_000, output_tokens=1_000_000) == 0.0


def test_cost_usd_uses_configured_prices() -> None:
    client = AnthropicLLMClient(
        client=_StubAnthropicClient(_text_message("hi")),
        input_price_per_mtok=3.0,
        output_price_per_mtok=15.0,
    )

    cost = client.cost_usd(input_tokens=1_000_000, output_tokens=1_000_000)

    assert cost == pytest.approx(18.0)


def test_complete_translates_a_plain_text_response() -> None:
    stub = _StubAnthropicClient(_text_message("hello there", input_tokens=42, output_tokens=7))
    client = AnthropicLLMClient(client=stub)

    response = client.complete(system="be nice", messages=[{"role": "user", "content": "hi"}])

    assert isinstance(response, LLMResponse)
    assert response.text == "hello there"
    assert response.tool_uses == []
    assert response.wants_tool_use is False
    assert response.input_tokens == 42
    assert response.output_tokens == 7
    assert response.content_blocks == [{"type": "text", "text": "hello there"}]
    assert stub.messages.last_kwargs is not None
    assert "tools" not in stub.messages.last_kwargs


def test_complete_translates_a_tool_use_response() -> None:
    message = Message(
        id="msg_1",
        type="message",
        role="assistant",
        model="claude-sonnet-5",
        content=[
            TextBlock(type="text", text="I'll read the file."),
            ToolUseBlock(type="tool_use", id="tu_1", name="read_file", input={"path": "a.py"}),
        ],
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=20, output_tokens=8),
    )
    client = AnthropicLLMClient(client=_StubAnthropicClient(message))

    response = client.complete(
        system="be helpful",
        messages=[{"role": "user", "content": "read a.py"}],
        tools=[{"name": "read_file", "description": "read a file", "input_schema": {}}],
    )

    assert response.text == "I'll read the file."
    assert response.tool_uses == [ToolUse(id="tu_1", name="read_file", arguments={"path": "a.py"})]
    assert response.wants_tool_use is True
    assert response.stop_reason == "tool_use"
    assert response.content_blocks == [
        {"type": "text", "text": "I'll read the file."},
        {"type": "tool_use", "id": "tu_1", "name": "read_file", "input": {"path": "a.py"}},
    ]


def test_complete_omits_tools_kwarg_when_none_given() -> None:
    stub = _StubAnthropicClient(_text_message("ok"))
    client = AnthropicLLMClient(client=stub)

    client.complete(system="s", messages=[{"role": "user", "content": "hi"}], tools=None)

    assert stub.messages.last_kwargs is not None
    assert "tools" not in stub.messages.last_kwargs


def test_complete_passes_tools_through_when_given() -> None:
    stub = _StubAnthropicClient(_text_message("ok"))
    client = AnthropicLLMClient(client=stub)
    tools = [{"name": "read_file", "description": "read a file", "input_schema": {}}]

    client.complete(system="s", messages=[{"role": "user", "content": "hi"}], tools=tools)

    assert stub.messages.last_kwargs is not None
    assert stub.messages.last_kwargs["tools"] == tools
