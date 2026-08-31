"""Tests for src/search_store/selectors.py."""

from __future__ import annotations

from boardfarm_api.ai_engine.search_store.data_models import ParsedKey
from boardfarm_api.ai_engine.search_store.selectors import (
    combine_and,
    select_by_categories,
    select_by_modules,
    select_by_repos,
)


def _pk(category="c", repo="r", file_key="path__to__module") -> ParsedKey:
    return ParsedKey(
        raw_key=f"{repo}@{file_key}::{category}::n",
        root_index_key=f"{repo}@{file_key}::{category}::n",
        repo=repo,
        file_key=file_key,
        category=category,
        callable_name="n",
    )


class TestSelectByCategories:
    def test_matches(self):
        sel = select_by_categories(["usecases", "templates"])
        assert sel(_pk(category="usecases")) is True
        assert sel(_pk(category="templates")) is True

    def test_does_not_match(self):
        sel = select_by_categories(["usecases"])
        assert sel(_pk(category="other")) is False

    def test_empty_categories_matches_nothing(self):
        sel = select_by_categories([])
        assert sel(_pk()) is False


class TestSelectByRepos:
    def test_matches(self):
        sel = select_by_repos(["repo1", "repo2"])
        assert sel(_pk(repo="repo1")) is True
        assert sel(_pk(repo="repo2")) is True

    def test_does_not_match(self):
        sel = select_by_repos(["repo1"])
        assert sel(_pk(repo="other")) is False


class TestSelectByModules:
    def test_substring_match(self):
        # file_path is reconstructed from file_key with "__" → "/"
        sel = select_by_modules(["network"])
        assert sel(_pk(file_key="src__network__http")) is True

    def test_no_match(self):
        sel = select_by_modules(["does_not_exist"])
        assert sel(_pk(file_key="src__other__file")) is False

    def test_multiple_patterns_any_match(self):
        sel = select_by_modules(["alpha", "beta"])
        assert sel(_pk(file_key="x__beta__y")) is True


class TestCombineAnd:
    def test_all_pass(self):
        sel = combine_and(select_by_categories(["usecases"]), select_by_repos(["r1"]))
        assert sel(_pk(category="usecases", repo="r1")) is True

    def test_any_fail(self):
        sel = combine_and(select_by_categories(["usecases"]), select_by_repos(["r1"]))
        assert sel(_pk(category="usecases", repo="other")) is False
        assert sel(_pk(category="other", repo="r1")) is False

    def test_no_selectors_matches_all(self):
        sel = combine_and()  # all(...) on empty is True
        assert sel(_pk()) is True
