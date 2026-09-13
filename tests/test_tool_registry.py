from pathlib import Path

import pytest

from swe_agent.agents.tool_registry import execute_tool, tool_definitions
from swe_agent.tools import ToolError

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


def test_tool_definitions_cover_all_ten_tools_with_schemas(sandbox: Path) -> None:
    definitions = tool_definitions(sandbox)

    names = {d["name"] for d in definitions}
    assert names == _TOOL_NAMES
    for definition in definitions:
        assert definition["description"]
        assert definition["input_schema"]["type"] == "object"


def test_execute_tool_read_file(sandbox: Path) -> None:
    result = execute_tool(sandbox, "read_file", {"path": "greeter.py"})

    assert "def greet" in result


def test_execute_tool_write_file_returns_status_ok(sandbox_copy: Path) -> None:
    result = execute_tool(sandbox_copy, "write_file", {"path": "notes.txt", "content": "hi\n"})

    assert result == {"status": "ok"}
    assert (sandbox_copy / "notes.txt").read_text() == "hi\n"


def test_execute_tool_run_tests_reports_the_deliberate_failure(sandbox: Path) -> None:
    result = execute_tool(sandbox, "run_tests", {"path": "tests"})

    assert result["failed"] == 1


def test_execute_tool_raises_tool_error_for_missing_file(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="no such file"):
        execute_tool(sandbox, "read_file", {"path": "nope.py"})


def test_execute_tool_raises_tool_error_for_unknown_tool(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="unknown tool"):
        execute_tool(sandbox, "delete_everything", {})
