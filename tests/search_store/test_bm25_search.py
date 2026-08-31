"""Tests for src/search_store/bm25_search.py."""

from __future__ import annotations

from boardfarm_api.ai_engine.search_store.bm25_search import STOPWORDS, BM25SearchEngine
from boardfarm_api.ai_engine.search_store.data_models import SearchPairs


class TestBM25SearchEngine:
    def _make_engine(self, docs=None, keys=None) -> BM25SearchEngine:
        docs = docs or [
            "reboot device wait DOCSIS registration online",
            "start http server on WAN client",
            "verify HTTP server accessible via IPv4 address",
            "send packet over network interface",
        ]
        keys = keys or [f"k{i}" for i in range(len(docs))]
        return BM25SearchEngine(SearchPairs(documents=docs, keys=keys))

    def _trivial_engine(self) -> BM25SearchEngine:
        """A minimal engine when the test only needs the tokenizer methods."""
        return BM25SearchEngine(
            SearchPairs(
                documents=["alpha beta gamma delta"],
                keys=["k0"],
            )
        )

    def test_process_tokens_snake_case(self):
        eng = self._trivial_engine()
        out = eng._process_tokens("get_device_status")
        assert "get device status" in out

    def test_process_tokens_camel_case(self):
        eng = self._trivial_engine()
        out = eng._process_tokens("getDeviceStatus")
        assert "get device status" in out

    def test_process_tokens_acronym(self):
        eng = self._trivial_engine()
        out = eng._process_tokens("TR069Setup")
        # ACRONYMWord → ACRONYM Word
        assert "tr069 setup" in out

    def test_process_tokens_strips_punctuation(self):
        eng = self._trivial_engine()
        out = eng._process_tokens("hello, world!")
        assert "," not in out
        assert "!" not in out

    def test_tokenize_removes_stopwords(self):
        eng = self._trivial_engine()
        toks = eng.tokenize("the and of")
        # All are stopwords
        assert toks == []

    def test_tokenize_drops_short_tokens(self):
        eng = self._trivial_engine()
        toks = eng.tokenize("ab cdef gh ijklm")
        # Tokens len <= 2 dropped
        assert all(len(t) > 2 for t in toks)

    def test_tokenize_stems(self):
        eng = self._trivial_engine()
        toks = eng.tokenize("running runs runner")
        # All variants should stem to the same root via PorterStemmer
        assert len(set(toks)) <= 2  # may be 1 or 2

    def test_search_returns_ranked_results(self):
        eng = self._make_engine()
        results = eng.search("reboot DOCSIS", top_k=3)
        assert isinstance(results, list)
        assert len(results) <= 3
        # Each is (idx, score)
        for idx, score in results:
            assert isinstance(idx, int)
            assert score > 0

    def test_search_top_k_limits(self):
        eng = self._make_engine()
        results = eng.search("http", top_k=1)
        assert len(results) <= 1

    def test_search_no_matches_returns_empty(self):
        eng = self._make_engine()
        # Query with non-matching unique words
        results = eng.search("xyz123 qwerty098", top_k=5)
        assert results == []

    def test_build_doc_repeats_first_field(self):
        eng = self._trivial_engine()
        # When doc uses "|" separator, first field's tokens appear twice
        doc = eng.build_doc("reboot_func | reboot the device wait now")
        # Token "reboot" should appear at least twice
        from collections import Counter

        c = Counter(doc)
        assert c.get("reboot", 0) >= 2

    def test_use_okapi_false_uses_bm25plus(self):
        from rank_bm25 import BM25Plus

        eng = BM25SearchEngine(
            SearchPairs(documents=["hello world", "another doc"], keys=["a", "b"]),
            use_okapi=False,
        )
        assert isinstance(eng.bm25_engine, BM25Plus)


class TestStopwords:
    def test_has_common_stopwords(self):
        assert "the" in STOPWORDS
        assert "and" in STOPWORDS
        assert "for" in STOPWORDS
