"""Pytest configuration file."""

from __future__ import annotations


def pytest_addoption(parser) -> None:
    """Add pytest options."""
    parser.addoption(
        "--use-cases",
        action="store",
        default="",
        help="comma-separated list of use case IDs to run",
    )


def pytest_collection_modifyitems(config, items) -> None:
    """Deselect tests that do not match the --use-cases option."""
    use_cases_to_run = config.getoption("--use-cases")
    if not use_cases_to_run:
        return

    selected_items = []
    deselected_items = []
    use_case_ids = [uc.strip() for uc in use_cases_to_run.split(",")]

    for item in items:
        use_case_id = getattr(item.function, "use_case_id", None)
        if use_case_id and use_case_id in use_case_ids:
            selected_items.append(item)
        else:
            deselected_items.append(item)

    items[:] = selected_items
    if deselected_items:
        config.hook.pytest_deselected(items=deselected_items)
