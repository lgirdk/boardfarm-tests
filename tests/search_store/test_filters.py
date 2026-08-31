"""Tests for src/search_store/filters.py."""

from __future__ import annotations

from boardfarm_api.ai_engine.search_store.filters import RepoExcludeFilter, RepoPriorityFilter


def _hit(
    repo_name: str = "r1",
    root_name: str = "foo",
    doc: str = "doc",
) -> dict:
    return {
        "doc": doc,
        "category": "c",
        "signature": "()",
        "repo_name": repo_name,
        "root_name": root_name,
        "file_name": "f",
        "file_path": "f/path",
    }


class TestRepoPriorityFilter:
    def test_keeps_priority_repo_when_duplicate_name(self):
        # Two entries with the same root_name "foo" from different repos
        hits = {
            1: _hit(repo_name="repo_low", root_name="foo"),
            2: _hit(repo_name="repo_high", root_name="foo"),
        }
        f = RepoPriorityFilter(priority_list=["repo_high", "repo_low"])
        out = f(hits)
        # repo_high wins
        assert 2 in out
        assert 1 not in out

    def test_falls_back_when_no_priority_repo_present(self):
        hits = {
            1: _hit(repo_name="repo_a", root_name="foo"),
            2: _hit(repo_name="repo_b", root_name="foo"),
        }
        f = RepoPriorityFilter(priority_list=["nope"])
        out = f(hits)
        # Neither matches → both kept
        assert set(out.keys()) == {1, 2}

    def test_different_names_not_affected(self):
        hits = {
            1: _hit(repo_name="repo_a", root_name="foo"),
            2: _hit(repo_name="repo_b", root_name="bar"),
        }
        f = RepoPriorityFilter(priority_list=["repo_a"])
        out = f(hits)
        # foo's only entry is in priority repo; bar's only entry isn't in priority
        # so bar falls back to fallback path (keeps all)
        assert set(out.keys()) == {1, 2}

    def test_empty_hits(self):
        f = RepoPriorityFilter(priority_list=["x"])
        assert f({}) == {}

    def test_empty_priority_list(self):
        hits = {1: _hit(repo_name="r1", root_name="foo")}
        f = RepoPriorityFilter(priority_list=[])
        out = f(hits)
        assert set(out.keys()) == {1}


class TestRepoExcludeFilter:
    def test_excludes_specified_repos(self):
        hits = {
            1: _hit(repo_name="bad", root_name="x"),
            2: _hit(repo_name="ok", root_name="y"),
        }
        f = RepoExcludeFilter(exclude_repos=["bad"])
        out = f(hits)
        assert set(out.keys()) == {2}

    def test_excludes_multiple_repos(self):
        hits = {
            1: _hit(repo_name="bad1"),
            2: _hit(repo_name="ok"),
            3: _hit(repo_name="bad2"),
        }
        f = RepoExcludeFilter(exclude_repos=["bad1", "bad2"])
        out = f(hits)
        assert set(out.keys()) == {2}

    def test_empty_exclude_list_keeps_all(self):
        hits = {1: _hit(repo_name="r1"), 2: _hit(repo_name="r2")}
        f = RepoExcludeFilter(exclude_repos=[])
        out = f(hits)
        assert set(out.keys()) == {1, 2}

    def test_uses_set_for_lookup(self):
        f = RepoExcludeFilter(exclude_repos=["a", "b"])
        assert isinstance(f.exclude_repos, set)
