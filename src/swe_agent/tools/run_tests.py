import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from swe_agent.tools.errors import ToolError
from swe_agent.tools.paths import resolve_path


def run_tests(repo_root: Path, path: str = ".") -> dict[str, Any]:
    target = resolve_path(repo_root, path)
    if not target.exists():
        raise ToolError(f"no such path: {path!r}")

    with tempfile.TemporaryDirectory() as tmp_dir:
        junit_path = Path(tmp_dir) / "junit.xml"
        try:
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    str(target),
                    "-q",
                    f"--junitxml={junit_path}",
                ],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired as exc:
            raise ToolError("pytest run timed out") from exc

        if not junit_path.exists():
            raise ToolError("pytest did not produce a junit report")

        suite = _find_testsuite(ET.parse(junit_path).getroot())

    total = int(suite.get("tests", 0))
    failed = int(suite.get("failures", 0))
    errors = int(suite.get("errors", 0))

    failing_tests: list[dict[str, str]] = []
    for case in suite.iter("testcase"):
        node = case.find("failure")
        if node is None:
            node = case.find("error")
        if node is not None:
            failing_tests.append(
                {
                    "name": case.get("name", ""),
                    "message": (node.get("message") or "").strip(),
                }
            )

    return {
        "total": total,
        "passed": total - failed - errors,
        "failed": failed,
        "errors": errors,
        "failing_tests": failing_tests,
    }


def _find_testsuite(root: ET.Element) -> ET.Element:
    if root.tag == "testsuite":
        return root
    suite = root.find("testsuite")
    if suite is None:
        raise ToolError("unexpected junit report format")
    return suite
