from pathlib import Path

from swe_agent.tools import run_tests


def test_run_tests_reports_pass_and_fail_counts(sandbox: Path) -> None:
    result = run_tests(sandbox, "tests")

    assert result["total"] == 2
    assert result["passed"] == 1
    assert result["failed"] == 1
    assert result["failing_tests"][0]["name"] == "test_multiply_is_deliberately_wrong"
