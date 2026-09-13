from pathlib import Path

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def read_file(repo_root: Path, path: str) -> str:
    target = resolve_path(repo_root, path)
    if not target.is_file():
        raise ToolError(f"no such file: {path!r}")
    try:
        return target.read_text()
    except UnicodeDecodeError as exc:
        raise ToolError(f"cannot read {path!r} as text: {exc}") from exc
