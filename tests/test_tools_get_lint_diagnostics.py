from pathlib import Path

from swe_agent.tools import get_lint_diagnostics, write_file


def test_get_lint_diagnostics_flags_an_unused_import(sandbox_copy: Path) -> None:
    write_file(sandbox_copy, "bad.py", "import os\n\n\ndef unused() -> None:\n    pass\n")

    diagnostics = get_lint_diagnostics(sandbox_copy, "bad.py")

    codes = {d["code"] for d in diagnostics}
    assert "F401" in codes


def test_get_lint_diagnostics_clean_file_has_no_findings(sandbox: Path) -> None:
    diagnostics = get_lint_diagnostics(sandbox, "greeter.py")

    assert diagnostics == []
