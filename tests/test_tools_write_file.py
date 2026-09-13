from pathlib import Path

from swe_agent.tools import read_file, write_file


def test_write_file_creates_new_file_and_parents(sandbox_copy: Path) -> None:
    write_file(sandbox_copy, "notes/todo.txt", "buy milk\n")

    assert read_file(sandbox_copy, "notes/todo.txt") == "buy milk\n"


def test_write_file_overwrites_existing_file(sandbox_copy: Path) -> None:
    write_file(sandbox_copy, "greeter.py", "def greet(name: str) -> str:\n    return name\n")

    assert "return name" in read_file(sandbox_copy, "greeter.py")
