import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def get_lint_diagnostics(repo_root: Path, path: str = ".") -> list[dict[str, Any]]:
    target = resolve_path(repo_root, path)
    if not target.exists():
        raise ToolError(f"no such path: {path!r}")

    try:
        completed = subprocess.run(
            [*_ruff_command(), "check", str(target), "--output-format=json", "--no-fix"],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise ToolError("ruff is not installed or not on PATH") from exc

    try:
        raw: list[dict[str, Any]] = json.loads(completed.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise ToolError(f"could not parse ruff output: {exc}") from exc

    root = repo_root.resolve()
    diagnostics: list[dict[str, Any]] = []
    for entry in raw:
        file_path = Path(entry["filename"])
        try:
            rel = str(file_path.relative_to(root))
        except ValueError:
            rel = str(file_path)
        diagnostics.append(
            {
                "file": rel,
                "line": entry["location"]["row"],
                "code": entry["code"],
                "message": entry["message"],
            }
        )
    return diagnostics


def _ruff_command() -> list[str]:
    exe = shutil.which("ruff")
    return [exe] if exe else [sys.executable, "-m", "ruff"]
