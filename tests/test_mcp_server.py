import asyncio
import json
import subprocess
from pathlib import Path
from typing import Any

import pytest
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError as MCPToolError
from mcp.types import CallToolResult

from swe_agent.mcp_server import build_server
from swe_agent.trace import Tracer


def _read_trace_lines(tracer: Tracer) -> list[dict[str, Any]]:
    return [json.loads(line) for line in tracer.path.read_text().splitlines()]

_TOOL_NAMES = {
    "read_file",
    "write_file",
    "edit_file",
    "list_dir",
    "search_code",
    "run_shell",
    "run_tests",
    "git_diff",
    "apply_patch",
    "get_lint_diagnostics",
}


def _call(server: MCPServer, name: str, arguments: dict[str, Any]) -> CallToolResult:
    result = asyncio.run(server.call_tool(name, arguments))
    assert isinstance(result, CallToolResult)
    return result


def test_server_exposes_all_ten_tools(sandbox: Path) -> None:
    server = build_server(sandbox)

    names = {tool.name for tool in asyncio.run(server.list_tools())}

    assert names == _TOOL_NAMES


def test_read_file_tool_returns_contents(sandbox: Path) -> None:
    server = build_server(sandbox)

    result = _call(server, "read_file", {"path": "greeter.py"})

    assert result.is_error is False
    assert result.structured_content == {"result": (sandbox / "greeter.py").read_text()}


def test_read_file_tool_translates_missing_file_error(sandbox: Path) -> None:
    server = build_server(sandbox)

    with pytest.raises(MCPToolError, match="no such file"):
        _call(server, "read_file", {"path": "nope.py"})


def test_write_file_tool_creates_file(sandbox_copy: Path) -> None:
    server = build_server(sandbox_copy)

    result = _call(server, "write_file", {"path": "notes.txt", "content": "hi\n"})

    assert result.structured_content == {"status": "ok"}
    assert (sandbox_copy / "notes.txt").read_text() == "hi\n"


def test_edit_file_tool_translates_non_unique_match_error(sandbox_copy: Path) -> None:
    server = build_server(sandbox_copy)

    with pytest.raises(MCPToolError, match="not unique"):
        _call(
            server,
            "edit_file",
            {"path": "math_utils.py", "old_str": "return a", "new_str": "return b"},
        )


def test_list_dir_tool_lists_entries(sandbox: Path) -> None:
    server = build_server(sandbox)

    result = _call(server, "list_dir", {})

    assert "greeter.py" in result.structured_content["result"]


def test_search_code_tool_finds_matches(sandbox: Path) -> None:
    server = build_server(sandbox)

    result = _call(server, "search_code", {"pattern": r"def greet", "path": "greeter.py"})

    matches = result.structured_content["result"]
    assert len(matches) == 1
    assert matches[0]["file"] == "greeter.py"


def test_run_shell_tool_captures_output(sandbox: Path) -> None:
    server = build_server(sandbox)

    result = _call(server, "run_shell", {"command": ["echo", "hi"]})

    assert result.structured_content["stdout"].strip() == "hi"
    assert result.structured_content["returncode"] == 0


def test_run_tests_tool_reports_failures(sandbox: Path) -> None:
    server = build_server(sandbox)

    result = _call(server, "run_tests", {"path": "tests"})

    assert result.structured_content["total"] == 2
    assert result.structured_content["failed"] == 1


def test_git_diff_tool_scopes_to_path(git_repo: Path) -> None:
    server = build_server(git_repo)
    (git_repo / "a.txt").write_text("two\n")

    result = _call(server, "git_diff", {"path": "a.txt"})

    assert "a.txt" in result.structured_content["result"]


def test_apply_patch_tool_applies_diff(git_repo: Path) -> None:
    server = build_server(git_repo)
    original = (git_repo / "a.txt").read_text()
    (git_repo / "a.txt").write_text("two\n")
    diff = subprocess.run(
        ["git", "diff"], cwd=git_repo, capture_output=True, text=True, check=True
    ).stdout
    (git_repo / "a.txt").write_text(original)

    result = _call(server, "apply_patch", {"diff": diff})

    assert result.structured_content == {"status": "ok"}
    assert (git_repo / "a.txt").read_text() == "two\n"


def test_apply_patch_tool_translates_path_escape_error(git_repo: Path) -> None:
    server = build_server(git_repo)
    malicious_diff = (
        "--- a/../outside.txt\n+++ b/../outside.txt\n@@ -1 +1 @@\n-old\n+new\n"
    )

    with pytest.raises(MCPToolError, match="escapes repo root"):
        _call(server, "apply_patch", {"diff": malicious_diff})


def test_get_lint_diagnostics_tool_flags_unused_import(sandbox_copy: Path) -> None:
    server = build_server(sandbox_copy)
    _call(server, "write_file", {"path": "bad.py", "content": "import os\n"})

    result = _call(server, "get_lint_diagnostics", {"path": "bad.py"})

    codes = {d["code"] for d in result.structured_content["result"]}
    assert "F401" in codes


def test_tracer_records_successful_tool_call(sandbox: Path, tmp_path: Path) -> None:
    tracer = Tracer("mcp-test", trace_dir=tmp_path)
    server = build_server(sandbox, tracer=tracer)

    _call(server, "read_file", {"path": "greeter.py"})

    event = _read_trace_lines(tracer)[0]
    assert event["kind"] == "tool"
    assert event["name"] == "read_file"
    assert event["input"] == {"path": "greeter.py"}
    assert event["output"] == (sandbox / "greeter.py").read_text()
    assert event["error"] is None
    assert event["latency_ms"] >= 0.0


def test_tracer_records_error_for_translated_tool_failure(sandbox: Path, tmp_path: Path) -> None:
    tracer = Tracer("mcp-test", trace_dir=tmp_path)
    server = build_server(sandbox, tracer=tracer)

    with pytest.raises(MCPToolError, match="no such file"):
        _call(server, "read_file", {"path": "nope.py"})

    event = _read_trace_lines(tracer)[0]
    assert event["name"] == "read_file"
    assert "no such file" in event["error"]
    assert event["output"] is None


def test_without_tracer_tools_still_work(sandbox: Path) -> None:
    server = build_server(sandbox)

    result = _call(server, "read_file", {"path": "greeter.py"})

    assert result.is_error is False
