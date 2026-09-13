from pathlib import Path

import pytest

from swe_agent.tools import ToolError, search_code


def test_search_code_finds_matches_across_files(sandbox: Path) -> None:
    matches = search_code(sandbox, r"def \w+")

    files = {m["file"] for m in matches}
    assert "greeter.py" in files
    assert "math_utils.py" in files


def test_search_code_scopes_to_a_single_file(sandbox: Path) -> None:
    matches = search_code(sandbox, r"def ", path="greeter.py")

    assert len(matches) == 1
    assert matches[0]["file"] == "greeter.py"
    assert matches[0]["line"] == 1


def test_search_code_rejects_invalid_regex(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="invalid regex"):
        search_code(sandbox, "(unclosed")
