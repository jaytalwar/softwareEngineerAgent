import subprocess
from pathlib import Path
from typing import Any

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def run_shell(
    repo_root: Path, command: list[str], cwd: str = ".", timeout: float = 30.0
) -> dict[str, Any]:
    if not command:
        raise ToolError("command must be a non-empty argv list")

    resolved_cwd = resolve_path(repo_root, cwd)
    if not resolved_cwd.is_dir():
        raise ToolError(f"no such directory: {cwd!r}")

    try:
        completed = subprocess.run(
            command,
            cwd=resolved_cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        return {
            "returncode": None,
            "stdout": exc.stdout or "",
            "stderr": exc.stderr or "",
            "timed_out": True,
        }
    except FileNotFoundError as exc:
        raise ToolError(f"command not found: {command[0]!r}") from exc

    return {
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "timed_out": False,
    }
