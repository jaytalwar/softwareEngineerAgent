"""Shared helpers for agent node implementations."""

from datetime import UTC, datetime
from typing import Any

from swe_agent.schemas import AgentMessage


def utcnow() -> datetime:
    return datetime.now(UTC)


def to_anthropic_messages(messages: list[AgentMessage]) -> list[dict[str, Any]]:
    """Flatten our own message history into Anthropic's `messages` shape.

    Every `AgentMessage` we persist is plain text (tool-call detail from a
    Coder turn is folded into its final summary before being appended), so
    the mapping is simple: "assistant" stays "assistant", everything else
    (user, system, tool) becomes a "user" turn — Claude's Messages API only
    accepts "user"/"assistant" in this list.
    """
    return [
        {"role": "assistant" if m.role == "assistant" else "user", "content": m.content}
        for m in messages
    ]
