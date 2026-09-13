from pathlib import Path

from swe_agent.tools.paths import resolve_path


def write_file(repo_root: Path, path: str, content: str) -> None:
    target = resolve_path(repo_root, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
