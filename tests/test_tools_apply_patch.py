import subprocess
from pathlib import Path

import pytest

from swe_agent.tools import ToolError, apply_patch, read_file


def _diff_for_content_change(repo: Path, new_content: str) -> str:
    original = (repo / "a.txt").read_text()
    (repo / "a.txt").write_text(new_content)
    diff = subprocess.run(
        ["git", "diff"], cwd=repo, capture_output=True, text=True, check=True
    ).stdout
    (repo / "a.txt").write_text(original)
    return diff


def test_apply_patch_applies_a_unified_diff(git_repo: Path) -> None:
    diff = _diff_for_content_change(git_repo, "two\n")

    apply_patch(git_repo, diff)

    assert read_file(git_repo, "a.txt") == "two\n"


def test_apply_patch_rejects_path_outside_repo_root(git_repo: Path) -> None:
    malicious_diff = (
        "--- a/../outside.txt\n"
        "+++ b/../outside.txt\n"
        "@@ -1 +1 @@\n"
        "-old\n"
        "+new\n"
    )

    with pytest.raises(ToolError, match="escapes repo root"):
        apply_patch(git_repo, malicious_diff)


def test_apply_patch_invalid_diff_raises(git_repo: Path) -> None:
    with pytest.raises(ToolError, match="git apply failed"):
        apply_patch(git_repo, "not a real diff\n")
