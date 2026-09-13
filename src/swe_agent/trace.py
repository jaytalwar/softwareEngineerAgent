"""Structured JSON-line tracing for agent and tool invocations.

Each task gets its own append-only `traces/<task_id>.jsonl` file. Every line
is one `TraceEvent`: timestamp, whether it was an agent step or a tool call,
its name, input, output (or error), token count, and latency.
"""

import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

DEFAULT_TRACE_DIR = Path("traces")


def _utcnow() -> datetime:
    return datetime.now(UTC)


class TraceEvent(BaseModel):
    """One line of the trace: an agent step or a tool call, with its result."""

    task_id: str
    kind: Literal["agent", "tool"]
    name: str
    input: Any = None
    output: Any = None
    error: str | None = None
    tokens: int | None = None
    latency_ms: float
    timestamp: datetime = Field(default_factory=_utcnow)


@dataclass
class Span:
    """Mutable handle yielded by `Tracer.span()` for the caller to fill in."""

    output: Any = None
    error: str | None = None


class Tracer:
    """Writes `TraceEvent`s for one task as JSON lines to `traces/<task_id>.jsonl`."""

    def __init__(self, task_id: str, trace_dir: Path | str = DEFAULT_TRACE_DIR) -> None:
        self.task_id = task_id
        self.path = Path(trace_dir) / f"{task_id}.jsonl"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(
        self,
        *,
        kind: Literal["agent", "tool"],
        name: str,
        input: Any = None,
        output: Any = None,
        error: str | None = None,
        tokens: int | None = None,
        latency_ms: float,
    ) -> TraceEvent:
        event = TraceEvent(
            task_id=self.task_id,
            kind=kind,
            name=name,
            input=input,
            output=output,
            error=error,
            tokens=tokens,
            latency_ms=latency_ms,
        )
        with self.path.open("a") as f:
            f.write(event.model_dump_json() + "\n")
        return event

    @contextmanager
    def span(
        self,
        *,
        kind: Literal["agent", "tool"],
        name: str,
        input: Any = None,
        tokens: int | None = None,
    ) -> Iterator[Span]:
        """Time a block of code and record it as one trace event on exit.

        Set `span.output` inside the block; on an exception, `span.error` is
        filled in automatically and the exception still propagates.
        """
        span = Span()
        start = time.perf_counter()
        try:
            yield span
        except Exception as exc:
            span.error = str(exc)
            raise
        finally:
            latency_ms = (time.perf_counter() - start) * 1000
            self.record(
                kind=kind,
                name=name,
                input=input,
                output=span.output,
                error=span.error,
                tokens=tokens,
                latency_ms=latency_ms,
            )
