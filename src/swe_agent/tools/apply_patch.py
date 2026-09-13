import re
import subprocess
from pathlib import Path

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path

_TARGET_PATH_RE = re.compile(r"^\+\+\+ (?:b/)?(.+)$", re.MULTILINE)


def apply_patch(repo_root: Path, diff: str) -> None:
    for match in _TARGET_PATH_RE.finditer(diff):
        target = match.group(1).strip()
        if target == "/dev/null":
            continue
        resolve_path(repo_root, target)

    completed = subprocess.run(
        ["git", "apply", "--whitespace=nowarn", "-"],
        cwd=repo_root,
        input=diff,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise ToolError(f"git apply failed: {completed.stderr.strip()}")
