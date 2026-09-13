from math_utils import add, multiply


def test_add() -> None:
    assert add(2, 3) == 5


def test_multiply_is_deliberately_wrong() -> None:
    # Deliberately wrong expectation so the `run_tests` tool has a real
    # failure to surface.
    assert multiply(2, 3) == 999
