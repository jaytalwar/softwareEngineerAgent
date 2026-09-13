from pathlib import Path

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def list_dir(repo_root: Path, path: str = ".") -> list[str]:
    target = resolve_path(repo_root, path)
    if not target.is_dir():
        raise ToolError(f"no such directory: {path!r}")
    return sorted(entry.name for entry in target.iterdir())
