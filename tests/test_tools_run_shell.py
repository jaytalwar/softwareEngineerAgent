from pathlib import Path

import pytest

from swe_agent.tools import ToolError, run_shell


def test_run_shell_captures_stdout_and_exit_code(sandbox: Path) -> None:
    result = run_shell(sandbox, ["echo", "hi"])

    assert result["returncode"] == 0
    assert result["stdout"].strip() == "hi"
    assert result["timed_out"] is False


def test_run_shell_times_out(sandbox: Path) -> None:
    result = run_shell(sandbox, ["sleep", "2"], timeout=0.1)

    assert result["timed_out"] is True
    assert result["returncode"] is None


def test_run_shell_rejects_empty_command(sandbox: Path) -> None:
    with pytest.raises(ToolError, match="non-empty"):
        run_shell(sandbox, [])
