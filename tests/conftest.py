import shutil
import subprocess
from pathlib import Path

import pytest

SANDBOX_FIXTURES = Path(__file__).parent.parent / "sandbox_fixtures"


@pytest.fixture
def sandbox() -> Path:
    """The real, checked-in sandbox fixture repo — read-only, do not mutate."""
    return SANDBOX_FIXTURES


@pytest.fixture
def sandbox_copy(tmp_path: Path) -> Path:
    """A disposable copy of the sandbox fixture repo, safe to mutate."""
    destination = tmp_path / "sandbox_fixtures"
    shutil.copytree(SANDBOX_FIXTURES, destination)
    return destination


@pytest.fixture
def git_repo(tmp_path: Path) -> Path:
    """A fresh, isolated git repository with one committed file."""
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "a.txt").write_text("one\n")
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
    subprocess.run(["git", "add", "a.txt"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=repo, check=True)
    return repo
