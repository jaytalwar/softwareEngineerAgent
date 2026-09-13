import re
from pathlib import Path
from typing import Any

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path

_SKIP_DIRS = {".git", "__pycache__", ".venv", ".mypy_cache", ".ruff_cache", ".pytest_cache"}


def search_code(repo_root: Path, pattern: str, path: str = ".") -> list[dict[str, Any]]:
    target = resolve_path(repo_root, path)
    try:
        regex = re.compile(pattern)
    except re.error as exc:
        raise ToolError(f"invalid regex {pattern!r}: {exc}") from exc

    root = repo_root.resolve()
    if target.is_file():
        files = [target]
    else:
        files = sorted(
            candidate
            for candidate in target.rglob("*")
            if candidate.is_file()
            and not _SKIP_DIRS.intersection(candidate.relative_to(root).parts)
        )

    matches: list[dict[str, Any]] = []
    for file_path in files:
        try:
            lines = file_path.read_text().splitlines()
        except (UnicodeDecodeError, OSError):
            continue
        for line_no, line in enumerate(lines, start=1):
            if regex.search(line):
                matches.append(
                    {
                        "file": str(file_path.relative_to(root)),
                        "line": line_no,
                        "text": line,
                    }
                )
    return matches
