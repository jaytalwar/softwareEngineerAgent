"""Core data contracts shared between the orchestrator and the tool layer."""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AgentMessage(BaseModel):
    """A single turn in the conversation between agents, the user, or tools."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=lambda: uuid4().hex)
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ToolCall(BaseModel):
    """A request to invoke one tool with a given set of arguments."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=lambda: uuid4().hex)
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    requested_at: datetime = Field(default_factory=_utcnow)


class ToolResult(BaseModel):
    """The outcome of executing a `ToolCall`."""

    model_config = ConfigDict(frozen=True)

    call_id: str
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    success: bool
    output: Any = None
    error: str | None = None
    started_at: datetime
    finished_at: datetime

    @property
    def latency_ms(self) -> float:
        return (self.finished_at - self.started_at).total_seconds() * 1000


TaskStatus = Literal["pending", "running", "succeeded", "failed", "cancelled"]


class TaskState(BaseModel):
    """Mutable state threaded through the orchestrator's graph executor."""

    model_config = ConfigDict(validate_assignment=True)

    task_id: str = Field(default_factory=lambda: uuid4().hex)
    status: TaskStatus = "pending"
    messages: list[AgentMessage] = Field(default_factory=list)
    pending_tool_calls: list[ToolCall] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)
    iteration: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
