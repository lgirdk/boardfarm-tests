"""Tests for src/codegen/searcher_agent.py.

Focuses on the pure helpers (strip_json_comments, extract_json_from_string) and
the SearcherAgent integration points using mocks.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from boardfarm_api.ai_engine.codegen.data_models import CodegenDomainSetup, ResolvedStage
from boardfarm_api.ai_engine.codegen.enums import CodegenOutputType, CodegenPromptVariant
from boardfarm_api.ai_engine.codegen.schemas.search_agent_schemas import CALL_SEARCH_SCHEMA_INITIATE
from boardfarm_api.ai_engine.codegen.searcher_agent import (
    SchemaError,
    SearcherAgent,
    ValidationsError,
    extract_json_from_string,
    strip_json_comments,
)
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings

# ----------------------------- strip_json_comments -----------------------------


class TestStripJsonComments:
    def test_removes_line_comments(self):
        text = '{"a": 1} // trailing comment'
        out = strip_json_comments(text)
        assert "//" not in out
        assert '"a": 1' in out

    def test_removes_hash_comments(self):
        text = '{"a": 1} # trailing'
        out = strip_json_comments(text)
        assert "#" not in out

    def test_preserves_comments_inside_strings(self):
        text = '{"url": "http://example.com"}'
        out = strip_json_comments(text)
        # Embedded "//" inside a quoted string should remain
        assert "http://example.com" in out

    def test_preserves_hash_inside_strings(self):
        text = '{"x": "color #fff"}'
        out = strip_json_comments(text)
        assert "color #fff" in out


# ----------------------------- extract_json_from_string -----------------------------


class TestExtractJsonFromString:
    def test_parses_plain_json(self):
        data = extract_json_from_string(
            '{"action": "search", "nouns": ["a"], "queries": ["b"]}',
            CALL_SEARCH_SCHEMA_INITIATE,
        )
        assert data["action"] == "search"
        assert data["nouns"] == ["a"]

    def test_strips_markdown_json_fence(self):
        text = '```json\n{"action": "search", "nouns": [], "queries": []}\n```'
        out = extract_json_from_string(text, CALL_SEARCH_SCHEMA_INITIATE)
        assert out["action"] == "search"

    def test_strips_generic_fence(self):
        text = '```\n{"action": "search", "nouns": [], "queries": []}\n```'
        out = extract_json_from_string(text, CALL_SEARCH_SCHEMA_INITIATE)
        assert out["action"] == "search"

    def test_raises_on_invalid_json(self):
        with pytest.raises(ValidationsError):
            extract_json_from_string("not json at all", CALL_SEARCH_SCHEMA_INITIATE)

    def test_raises_validations_error_on_malformed_code_fence(self):
        # Malformed fence triggers an empty extraction that fails json.loads;
        # the except clause (which also catches IndexError) wraps it as
        # ValidationsError instead of letting the original exception escape.
        with pytest.raises(ValidationsError):
            extract_json_from_string("```json", CALL_SEARCH_SCHEMA_INITIATE)

    def test_raises_on_schema_violation(self):
        # Missing required 'action' field
        with pytest.raises(SchemaError):
            extract_json_from_string(
                '{"nouns": [], "queries": []}', CALL_SEARCH_SCHEMA_INITIATE
            )


# ----------------------------- SearcherAgent properties -----------------------------


class TestSearcherAgentOutputTaskType:
    def _make_agent(self) -> SearcherAgent:
        stage = ResolvedStage(
            llm=MagicMock(),
            settings=LLMCallSettings(),
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
        )
        return SearcherAgent(
            stage_config=stage,
            search_config=MagicMock(),
            search_engine=MagicMock(),
            prompt_manager=MagicMock(),
            domain_setup=CodegenDomainSetup("d"),
        )

    def test_output_task_type_raises_before_set(self):
        agent = self._make_agent()
        with pytest.raises(ValueError, match="output task type"):
            _ = agent.output_task_type

    def test_output_task_type_setter_accepts_valid_enum(self):
        agent = self._make_agent()
        agent.output_task_type = CodegenOutputType.PYTEST
        assert agent.output_task_type == CodegenOutputType.PYTEST

    def test_output_task_type_setter_rejects_invalid(self):
        agent = self._make_agent()
        with pytest.raises(ValueError, match="not the type"):
            agent.output_task_type = "pytest"  # type: ignore[assignment]


class TestSearcherAgentHelpers:
    def _make_agent(self) -> SearcherAgent:
        stage = ResolvedStage(
            llm=MagicMock(),
            settings=LLMCallSettings(),
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
        )
        return SearcherAgent(
            stage_config=stage,
            search_config=MagicMock(),
            search_engine=MagicMock(),
            prompt_manager=MagicMock(),
            domain_setup=CodegenDomainSetup("d"),
        )

    def test_prepare_index_for_llm(self):
        agent = self._make_agent()
        out = agent._prepare_index_for_llm([(101, "first doc"), (202, "second doc")])
        assert "[0] first doc" in out
        assert "[1] second doc" in out

    def test_index_and_format_corpus_hits_includes_signature(self):
        agent = self._make_agent()
        hits = {
            5: {
                "doc": "the doc text",
                "category": "usecases",
                "signature": "(self) -> int",
                "repo_name": "r",
                "root_name": "f",
                "file_name": "x",
                "file_path": "x/y",
            }
        }
        out = agent._index_and_format_corpus_hits(hits, add_signature=True)
        assert len(out) == 1
        idx, formatted = out[0]
        assert idx == 5
        assert "[usecases]" in formatted
        assert "the doc text" in formatted
        assert "sig: (self) -> int" in formatted

    def test_index_and_format_corpus_hits_skips_signature_when_disabled(self):
        agent = self._make_agent()
        hits = {
            5: {
                "doc": "d",
                "category": "c",
                "signature": "(x)",
                "repo_name": "r",
                "root_name": "f",
                "file_name": "x",
                "file_path": "x/y",
            }
        }
        out = agent._index_and_format_corpus_hits(hits, add_signature=False)
        _, formatted = out[0]
        assert "sig:" not in formatted

    def test_route_search_full_corpus(self):
        agent = self._make_agent()
        agent.search_engine.search_full_corpus.return_value = {}
        agent._route_search(
            "_full",
            ["q"],
            exclude_index=set(),
            bm25_top_k=1,
            faiss_top_k=1,
            faiss_threshold=10,
        )
        agent.search_engine.search_full_corpus.assert_called_once()
        agent.search_engine.search_subcorpus.assert_not_called()

    def test_route_search_subcorpus(self):
        agent = self._make_agent()
        agent.search_engine.search_subcorpus.return_value = {}
        agent._route_search(
            "usecases",
            ["q"],
            exclude_index=set(),
            bm25_top_k=1,
            faiss_top_k=1,
            faiss_threshold=10,
        )
        agent.search_engine.search_subcorpus.assert_called_once_with(
            "usecases",
            ["q"],
            exclude_index=set(),
            bm25_top_k=1,
            faiss_top_k=1,
            faiss_threshold=10,
        )

    def test_validate_output_search_with_no_queries_flags_issue(self):
        agent = self._make_agent()
        response = '{"action": "search", "nouns": [], "queries": []}'
        _, issues = agent._validate_output(
            response, CALL_SEARCH_SCHEMA_INITIATE, search_style="keep"
        )
        assert any("nouns or queries" in i for i in issues)

    def test_validate_output_search_with_queries_ok(self):
        agent = self._make_agent()
        response = '{"action": "search", "nouns": ["a"], "queries": ["b"]}'
        _, issues = agent._validate_output(
            response, CALL_SEARCH_SCHEMA_INITIATE, search_style="keep"
        )
        assert issues == []
