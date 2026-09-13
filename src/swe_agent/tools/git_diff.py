import subprocess
from pathlib import Path

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def git_diff(repo_root: Path, path: str | None = None) -> str:
    command = ["git", "diff"]
    if path is not None:
        resolve_path(repo_root, path)
        command += ["--", path]

    completed = subprocess.run(
        command,
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise ToolError(f"git diff failed: {completed.stderr.strip()}")
    return completed.stdout
