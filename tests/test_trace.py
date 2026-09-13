import json
from pathlib import Path
from typing import Any

import pytest

from swe_agent.trace import Tracer


def _read_lines(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines()]


def test_tracer_creates_trace_dir_and_one_file_per_task(tmp_path: Path) -> None:
    trace_dir = tmp_path / "traces"
    tracer = Tracer("task-a", trace_dir=trace_dir)

    tracer.record(
        kind="tool", name="read_file", input={"path": "a.py"}, output="hi", latency_ms=1.0
    )

    assert tracer.path == trace_dir / "task-a.jsonl"
    assert tracer.path.exists()


def test_record_writes_one_json_line_with_expected_fields(tmp_path: Path) -> None:
    tracer = Tracer("task-a", trace_dir=tmp_path)

    tracer.record(
        kind="tool",
        name="read_file",
        input={"path": "a.py"},
        output="contents",
        tokens=42,
        latency_ms=12.5,
    )

    lines = _read_lines(tracer.path)
    assert len(lines) == 1
    event = lines[0]
    assert event["task_id"] == "task-a"
    assert event["kind"] == "tool"
    assert event["name"] == "read_file"
    assert event["input"] == {"path": "a.py"}
    assert event["output"] == "contents"
    assert event["tokens"] == 42
    assert event["latency_ms"] == 12.5
    assert event["error"] is None
    assert "timestamp" in event


def test_multiple_records_append_multiple_lines(tmp_path: Path) -> None:
    tracer = Tracer("task-a", trace_dir=tmp_path)

    tracer.record(kind="agent", name="planner", input="go", output="plan", latency_ms=1.0)
    tracer.record(kind="tool", name="run_tests", input={}, output={"passed": 1}, latency_ms=2.0)

    lines = _read_lines(tracer.path)
    assert len(lines) == 2
    assert [line["name"] for line in lines] == ["planner", "run_tests"]


def test_different_task_ids_write_to_different_files(tmp_path: Path) -> None:
    tracer_a = Tracer("task-a", trace_dir=tmp_path)
    tracer_b = Tracer("task-b", trace_dir=tmp_path)

    tracer_a.record(kind="tool", name="x", latency_ms=1.0)
    tracer_b.record(kind="tool", name="y", latency_ms=1.0)

    assert _read_lines(tracer_a.path)[0]["name"] == "x"
    assert _read_lines(tracer_b.path)[0]["name"] == "y"


def test_span_records_output_and_positive_latency_on_success(tmp_path: Path) -> None:
    tracer = Tracer("task-a", trace_dir=tmp_path)

    with tracer.span(kind="tool", name="read_file", input={"path": "a.py"}) as span:
        span.output = "file contents"

    event = _read_lines(tracer.path)[0]
    assert event["output"] == "file contents"
    assert event["error"] is None
    assert event["latency_ms"] >= 0.0


def test_span_records_error_and_reraises_on_failure(tmp_path: Path) -> None:
    tracer = Tracer("task-a", trace_dir=tmp_path)

    with pytest.raises(ValueError, match="boom"), tracer.span(
        kind="tool", name="read_file", input={"path": "a.py"}
    ):
        raise ValueError("boom")

    event = _read_lines(tracer.path)[0]
    assert event["output"] is None
    assert event["error"] == "boom"


def test_span_passes_through_tokens(tmp_path: Path) -> None:
    tracer = Tracer("task-a", trace_dir=tmp_path)

    with tracer.span(kind="agent", name="planner", input="go", tokens=123) as span:
        span.output = "done"

    assert _read_lines(tracer.path)[0]["tokens"] == 123
