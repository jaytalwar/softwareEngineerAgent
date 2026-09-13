"""Claude tool-use definitions + direct in-process execution for the 10 tools.

Schemas are reused from `mcp_server.build_server()` — itself generated from
the tool functions' own type hints — so there's one source of truth for
each tool's parameters. Execution here calls straight into
`swe_agent.tools`, no MCP transport involved (per the direct-execution
design chosen for agent nodes).
"""

import asyncio
from collections.abc import Callable
from pathlib import Path
from typing import Any

from swe_agent.mcp_server import build_server
from swe_agent.tools import ToolError
from swe_agent.tools import apply_patch as _apply_patch
from swe_agent.tools import edit_file as _edit_file
from swe_agent.tools import get_lint_diagnostics as _get_lint_diagnostics
from swe_agent.tools import git_diff as _git_diff
from swe_agent.tools import list_dir as _list_dir
from swe_agent.tools import read_file as _read_file
from swe_agent.tools import run_shell as _run_shell
from swe_agent.tools import run_tests as _run_tests
from swe_agent.tools import search_code as _search_code
from swe_agent.tools import write_file as _write_file


def tool_definitions(repo_root: Path) -> list[dict[str, Any]]:
    """Claude tool-use definitions (name/description/input_schema)."""
    server = build_server(repo_root)
    mcp_tools = asyncio.run(server.list_tools())
    return [
        {"name": t.name, "description": t.description or "", "input_schema": t.input_schema}
        for t in mcp_tools
    ]


def _call_read_file(root: Path, args: dict[str, Any]) -> str:
    return _read_file(root, **args)


def _call_write_file(root: Path, args: dict[str, Any]) -> dict[str, str]:
    _write_file(root, **args)
    return {"status": "ok"}


def _call_edit_file(root: Path, args: dict[str, Any]) -> dict[str, str]:
    _edit_file(root, **args)
    return {"status": "ok"}


def _call_list_dir(root: Path, args: dict[str, Any]) -> list[str]:
    return _list_dir(root, **args)


def _call_search_code(root: Path, args: dict[str, Any]) -> list[dict[str, Any]]:
    return _search_code(root, **args)


def _call_run_shell(root: Path, args: dict[str, Any]) -> dict[str, Any]:
    return _run_shell(root, **args)


def _call_run_tests(root: Path, args: dict[str, Any]) -> dict[str, Any]:
    return _run_tests(root, **args)


def _call_git_diff(root: Path, args: dict[str, Any]) -> str:
    return _git_diff(root, **args)


def _call_apply_patch(root: Path, args: dict[str, Any]) -> dict[str, str]:
    _apply_patch(root, **args)
    return {"status": "ok"}


def _call_get_lint_diagnostics(root: Path, args: dict[str, Any]) -> list[dict[str, Any]]:
    return _get_lint_diagnostics(root, **args)


_DISPATCH: dict[str, Callable[[Path, dict[str, Any]], Any]] = {
    "read_file": _call_read_file,
    "write_file": _call_write_file,
    "edit_file": _call_edit_file,
    "list_dir": _call_list_dir,
    "search_code": _call_search_code,
    "run_shell": _call_run_shell,
    "run_tests": _call_run_tests,
    "git_diff": _call_git_diff,
    "apply_patch": _call_apply_patch,
    "get_lint_diagnostics": _call_get_lint_diagnostics,
}


def execute_tool(repo_root: Path, name: str, arguments: dict[str, Any]) -> Any:
    """Run one tool call directly (no MCP transport). Raises `ToolError`."""
    if name not in _DISPATCH:
        raise ToolError(f"unknown tool {name!r}")
    return _DISPATCH[name](repo_root, arguments)
