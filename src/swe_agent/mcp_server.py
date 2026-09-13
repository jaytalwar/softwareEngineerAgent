"""MCP server exposing the swe-agent tool layer.

Wraps the plain-function tools in `swe_agent.tools` as MCP tools bound to a
fixed, server-configured `repo_root` — callers only ever see domain
parameters (paths, patterns, commands), never the sandboxed root itself.
"""

import argparse
import functools
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypeVar

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError as MCPToolError

from swe_agent.tools import ToolError as InternalToolError
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
from swe_agent.trace import Tracer

_T = TypeVar("_T")


def _translate_errors(func: Callable[..., _T]) -> Callable[..., _T]:
    """Re-raise our `ToolError` as the MCP SDK's, so failures the caller
    anticipated (bad path, missing file, ...) surface to the model as a
    normal `is_error` result instead of an opaque server crash."""

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> _T:
        try:
            return func(*args, **kwargs)
        except InternalToolError as exc:
            raise MCPToolError(str(exc)) from exc

    return wrapper


def _trace(tracer: Tracer | None) -> Callable[[Callable[..., _T]], Callable[..., _T]]:
    """Record one `"tool"` trace event per call (input args, output/error,
    latency) under the tool's own function name. A no-op when `tracer` is
    None, so tracing stays fully opt-in."""

    def decorator(func: Callable[..., _T]) -> Callable[..., _T]:
        if tracer is None:
            return func

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> _T:
            with tracer.span(kind="tool", name=func.__name__, input=kwargs) as span:
                result = func(*args, **kwargs)
                span.output = result
                return result

        return wrapper

    return decorator


def build_server(repo_root: Path, *, tracer: Tracer | None = None) -> MCPServer:
    server = MCPServer(
        "swe-agent-tools",
        instructions="Filesystem, shell, git, test, and lint tools sandboxed to one repo root.",
    )

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def read_file(path: str) -> str:
        """Read a file's full contents."""
        return _read_file(repo_root, path)

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def write_file(path: str, content: str) -> dict[str, str]:
        """Create or overwrite a file with the given content."""
        _write_file(repo_root, path, content)
        return {"status": "ok"}

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def edit_file(path: str, old_str: str, new_str: str) -> dict[str, str]:
        """Replace an exact, unique substring in a file with new text."""
        _edit_file(repo_root, path, old_str, new_str)
        return {"status": "ok"}

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def list_dir(path: str = ".") -> list[str]:
        """List entries directly under a directory."""
        return _list_dir(repo_root, path)

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def search_code(pattern: str, path: str = ".") -> list[dict[str, Any]]:
        """Regex search across files under a path."""
        return _search_code(repo_root, pattern, path)

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def run_shell(command: list[str], cwd: str = ".", timeout: float = 30.0) -> dict[str, Any]:
        """Execute a shell command (argv list, never a shell string) and
        capture its stdout, stderr, and exit code."""
        return _run_shell(repo_root, command, cwd, timeout)

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def run_tests(path: str = ".") -> dict[str, Any]:
        """Run pytest under a path and return structured pass/fail results."""
        return _run_tests(repo_root, path)

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def git_diff(path: str | None = None) -> str:
        """Return `git diff` output, optionally scoped to a path."""
        return _git_diff(repo_root, path)

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def apply_patch(diff: str) -> dict[str, str]:
        """Apply a unified diff to the repo."""
        _apply_patch(repo_root, diff)
        return {"status": "ok"}

    @server.tool()
    @_translate_errors
    @_trace(tracer)
    def get_lint_diagnostics(path: str = ".") -> list[dict[str, Any]]:
        """Run ruff and return structured lint diagnostics."""
        return _get_lint_diagnostics(repo_root, path)

    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="MCP server exposing the swe-agent tool layer.")
    parser.add_argument(
        "--repo-root",
        default=os.environ.get("SWE_AGENT_REPO_ROOT", "."),
        help="Directory the tools are sandboxed to (default: $SWE_AGENT_REPO_ROOT or cwd).",
    )
    parser.add_argument(
        "--trace-task-id",
        default=None,
        help="If set, trace every tool call to traces/<TRACE_TASK_ID>.jsonl.",
    )
    args = parser.parse_args()

    tracer = Tracer(args.trace_task_id) if args.trace_task_id else None
    server = build_server(Path(args.repo_root), tracer=tracer)
    server.run()


if __name__ == "__main__":
    main()
