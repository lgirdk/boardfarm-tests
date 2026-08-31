from __future__ import annotations

from collections.abc import Callable
from typing import Protocol

from .data_models import ParsedKey

Selector = Callable[[ParsedKey], bool]


class SelectorFactory(Protocol):
    def __call__(self, values: list[str]) -> Selector: ...


def select_by_categories(categories: list[str]) -> Selector:
    """Selector for entries whose category matches any in the given list."""
    return lambda pk: pk.category in categories


def select_by_repos(repos: list[str]) -> Selector:
    """Selector for entries from any of the given repos."""
    return lambda pk: pk.repo in repos


def select_by_modules(module_patterns: list[str]) -> Selector:
    """Selector for entries from modules matching any of the given patterns."""
    return lambda pk: any(pattern in pk.file_path for pattern in module_patterns)


def combine_and(*selectors: Selector) -> Selector:
    """Combine multiple selectors with AND logic."""
    return lambda pk: all(sel(pk) for sel in selectors)
