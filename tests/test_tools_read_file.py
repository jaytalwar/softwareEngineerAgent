from pathlib import Path

import pytest

from swe_agent.tools import ToolError, read_file


def test_read_file_returns_contents(sandbox: Path) -> None:
    content = read_file(sandbox, "greeter.py")

    assert "def greet" in content


def test_read_file_missing_raises(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="no such file"):
        read_file(sandbox, "nope.py")


def test_read_file_rejects_path_escape(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="escapes repo root"):
        read_file(sandbox, "../pyproject.toml")
