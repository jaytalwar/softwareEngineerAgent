from pathlib import Path

import pytest

from swe_agent.tools import ToolError, list_dir


def test_list_dir_lists_top_level_entries(sandbox: Path) -> None:
    entries = list_dir(sandbox)

    assert "greeter.py" in entries
    assert "math_utils.py" in entries
    assert "tests" in entries


def test_list_dir_on_file_raises(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="no such directory"):
        list_dir(sandbox, "greeter.py")
