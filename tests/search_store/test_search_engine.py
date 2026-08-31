"""Tests for src/search_store/search_engine.py.

StubCodeSearchEngine has heavy constructor logic (builds BM25 + FAISS engines).
We mock those dependencies and focus on behavior we can verify cleanly.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from boardfarm_api.ai_engine.search_store.filters import RepoExcludeFilter
from boardfarm_api.ai_engine.search_store.search_engine import StubCodeSearchEngine
from boardfarm_api.ai_engine.search_store.utils import StubCodeRegistry


class _FakeEncoder:
    """Structural EncoderModelProtocol implementation."""

    import numpy as _np

    def encode_documents(self, texts):
        return self._np.ones((len(texts), 4), dtype=self._np.float32)

    def encode_queries(self, texts):
        return self._np.ones((len(texts), 4), dtype=self._np.float32)


@pytest.fixture
def built_registry(tmp_path: Path) -> StubCodeRegistry:
    """A small registry built from a sample stub index."""
    data = {
        "use_cases": [
            {
                "type": "function",
                "name": "do_thing",
                "file": "repo_a/use_cases/things.py",
                "import": "from repo_a.use_cases.things import do_thing",
            }
        ],
        "templates": [
            {
                "type": "class",
                "name": "MyDevice",
                "file": "repo_a/templates/device.py",
                "import": "from repo_a.templates.device import MyDevice",
                "methods": [{"name": "reboot", "signature": "(self)"}],
                "properties": [{"name": "ip", "return_type": "str"}],
            }
        ],
    }
    p = tmp_path / "stubs.json"
    p.write_text(json.dumps(data))
    reg = StubCodeRegistry(stub_index_path=p, artifacts_path=tmp_path / "artifacts")
    reg.build()
    return reg


@pytest.fixture
def patched_engine_deps():
    """Patch BM25 and FAISS deps for the StubCodeSearchEngine constructor."""
    with (
        patch("boardfarm_api.ai_engine.search_store.search_engine.BM25SearchEngine") as mock_bm25,
        patch("boardfarm_api.ai_engine.search_store.search_engine.FaissIndexManager") as mock_faiss,
    ):
        yield mock_bm25, mock_faiss


class TestStubCodeSearchEngineInit:
    def test_invalid_filter_rejected(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        with pytest.raises(ValueError, match="CorpusHitsFilterProtocol"):
            StubCodeSearchEngine(
                registry=built_registry,
                artifacts_path=tmp_path,
                encoder=_FakeEncoder(),
                corpus_filters=["not a filter"],  # type: ignore[list-item]
            )

    def test_builds_engines_for_each_subcorpus(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        # Register a sub-corpus
        built_registry.build_sub_corpus_groups(
            "use_cases_group",
            selector_fn=lambda pk: pk.category == "use_cases",
        )
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        assert "use_cases_group" in eng._sub_corpus_engines

    def test_builds_index_lookup_dicts(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        # The class has reboot and ip; the function is do_thing
        assert "reboot" in eng._indices_by_name
        assert "ip" in eng._indices_by_name
        assert "MyDevice" in eng._indices_by_name
        assert "do_thing" in eng._indices_by_name

        assert "use_cases" in eng._indices_by_category
        assert "templates" in eng._indices_by_category
        assert "repo_a" in eng._indices_by_repo
        assert "class" in eng._indices_by_type
        assert "function" in eng._indices_by_type
        assert "methods" in eng._indices_by_type
        assert "properties" in eng._indices_by_type
        assert "MyDevice" in eng._indices_by_owner_class

    def test_indices_lookup_methods(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        assert eng.indices_by_name("reboot")  # non-empty set
        assert eng.indices_by_name("nonexistent") == set()
        assert eng.indices_by_category("use_cases")
        assert eng.indices_by_category("unknown") == set()
        assert eng.indices_by_repo("repo_a")
        assert eng.indices_by_repo("nope") == set()
        assert eng.indices_by_type("class")
        assert eng.indices_by_type("function")
        assert eng.indices_by_owner_class("MyDevice")


class TestRunFiltersOnCorpushits:
    def test_no_filters_returns_input_unchanged(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        hits = {
            1: {
                "doc": "d",
                "category": "c",
                "signature": "",
                "repo_name": "r",
                "root_name": "n",
                "file_name": "f",
                "file_path": "f/p",
            }
        }
        out = eng.run_filters_on_corpushits(hits)
        assert out == hits

    def test_with_exclude_filter(self, built_registry, tmp_path, patched_engine_deps):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
            corpus_filters=[RepoExcludeFilter(["bad"])],
        )
        hits = {
            1: {
                "doc": "",
                "category": "",
                "signature": "",
                "repo_name": "bad",
                "root_name": "",
                "file_name": "",
                "file_path": "",
            },
            2: {
                "doc": "",
                "category": "",
                "signature": "",
                "repo_name": "ok",
                "root_name": "",
                "file_name": "",
                "file_path": "",
            },
        }
        out = eng.run_filters_on_corpushits(hits)
        assert set(out.keys()) == {2}


class TestGetStubsByCategory:
    def test_returns_only_matching_category(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        out = eng.get_stubs_by_category("use_cases")
        assert len(out) == 1
        assert out[0].root_stub.name == "do_thing"

    def test_empty_for_unknown_category(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        assert eng.get_stubs_by_category("unknown") == []


class TestResolveIndexEntries:
    def test_resolve_single(self, built_registry, tmp_path, patched_engine_deps):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        out = eng.resolve_single_index_entry(0)
        assert out.root_stub is not None
        assert out.parsed_key is not None

    def test_resolve_all(self, built_registry, tmp_path, patched_engine_deps):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        out = eng.resolve_all_index_entries([0, 1])
        assert len(out) == 2


class TestGetCorpusHits:
    def test_collects_hit_metadata(self, built_registry, tmp_path, patched_engine_deps):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        # Find the index of MyDevice (class)
        cls_indices = eng.indices_by_name("MyDevice")
        hits = eng.get_corpus_hits(cls_indices)
        assert len(hits) >= 1
        first_hit = next(iter(hits.values()))
        assert first_hit["root_name"] == "MyDevice"
        assert first_hit["repo_name"] == "repo_a"
        assert first_hit["category"] == "templates"


class TestSearchSubcorpusValidation:
    def test_unknown_subcorpus_raises(
        self, built_registry, tmp_path, patched_engine_deps
    ):
        eng = StubCodeSearchEngine(
            registry=built_registry,
            artifacts_path=tmp_path,
            encoder=_FakeEncoder(),
        )
        with pytest.raises(ValueError, match="not found"):
            eng.search_subcorpus("nonexistent", queries=["q"])
