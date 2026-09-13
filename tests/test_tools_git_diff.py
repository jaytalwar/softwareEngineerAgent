from pathlib import Path

import pytest

from swe_agent.tools import ToolError, git_diff


def test_git_diff_shows_unstaged_change(git_repo: Path) -> None:
    (git_repo / "a.txt").write_text("two\n")

    diff = git_diff(git_repo)

    assert "-one" in diff
    assert "+two" in diff


def test_git_diff_scopes_to_path(git_repo: Path) -> None:
    (git_repo / "a.txt").write_text("two\n")

    diff = git_diff(git_repo, path="a.txt")

    assert "a.txt" in diff


def test_git_diff_rejects_path_escape(git_repo: Path) -> None:
    with pytest.raises(ToolError, match="escapes repo root"):
        git_diff(git_repo, path="../outside.txt")
