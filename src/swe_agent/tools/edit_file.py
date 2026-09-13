from pathlib import Path

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def edit_file(repo_root: Path, path: str, old_str: str, new_str: str) -> None:
    target = resolve_path(repo_root, path)
    if not target.is_file():
        raise ToolError(f"no such file: {path!r}")

    text = target.read_text()
    count = text.count(old_str)
    if count == 0:
        raise ToolError(f"old_str not found in {path!r}")
    if count > 1:
        raise ToolError(f"old_str is not unique in {path!r} ({count} occurrences)")

    target.write_text(text.replace(old_str, new_str, 1))
