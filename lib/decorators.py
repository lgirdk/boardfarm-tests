"""Custom decorators for boardfarm tests."""

import pytest

def requirement(use_case_id: str, scenario: str):
    """
    Decorator to link a test case to a requirement use case and scenario.

    :param use_case_id: The ID of the use case (e.g., "UC-12346").
    :param scenario: The description of the scenario being tested.
    """
    def decorator(func):
        setattr(func, "use_case_id", use_case_id)
        setattr(func, "scenario", scenario)
        return func
    return decorator
