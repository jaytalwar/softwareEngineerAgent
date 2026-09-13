from pathlib import Path

import pytest

from swe_agent.tools import ToolError, edit_file, read_file


def test_edit_file_replaces_unique_match(sandbox_copy: Path) -> None:
    edit_file(sandbox_copy, "greeter.py", "Hello", "Hi")

    assert "Hi, {name}!" in read_file(sandbox_copy, "greeter.py")


def test_edit_file_missing_old_str_raises(sandbox_copy: Path) -> None:
    with pytest.raises(ToolError, match="not found"):
        edit_file(sandbox_copy, "greeter.py", "Goodbye", "Hi")


def test_edit_file_non_unique_old_str_raises(sandbox_copy: Path) -> None:
    with pytest.raises(ToolError, match="not unique"):
        edit_file(sandbox_copy, "math_utils.py", "return a", "return b")
