from pathlib import Path

from swe_agent.tools.errors import ToolError


def resolve_path(repo_root: Path, path: str) -> Path:
    """Resolve `path` relative to `repo_root`, refusing to let it escape."""
    root = repo_root.resolve()
    candidate = (root / path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise ToolError(f"path {path!r} escapes repo root {root}") from None
    return candidate
