"""Tests for src/codegen/driver_agent.py."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from boardfarm_api.ai_engine.codegen.data_models import (
    CodegenDomainSetup,
    IncludeEntry,
    ResolvedPipeline,
    ResolvedRuntimeCodeGenConfig,
    ResolvedStage,
)
from boardfarm_api.ai_engine.codegen.driver_agent import DriverAgent, deep_size
from boardfarm_api.ai_engine.codegen.enums import (
    CodegenPromptVariant,
    EntryKind,
)
from boardfarm_api.ai_engine.codegen.exceptions import CallbackException
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings

# ----------------------------- deep_size -----------------------------


class TestDeepSize:
    def test_int(self):
        assert deep_size(1) > 0

    def test_list(self):
        assert deep_size([1, 2, 3]) > deep_size([])

    def test_dict(self):
        assert deep_size({"a": 1}) > 0

    def test_handles_self_reference(self):
        lst = [1, 2]
        lst.append(lst)
        # Should not recurse infinitely
        deep_size(lst)

    def test_object_with_dict(self):
        class _Dummy:
            def __init__(self):
                self.x = "long string content"

        o = _Dummy()
        assert deep_size(o) > 0


# ----------------------------- DriverAgent setup -----------------------------


def _make_runtime_config(domain_setup: CodegenDomainSetup | None = None):
    stage = ResolvedStage(
        llm=MagicMock(),
        settings=LLMCallSettings(),
        prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
    )
    pipeline = ResolvedPipeline(reasoning=stage, search=stage, generation=stage)
    search_config = MagicMock()
    return ResolvedRuntimeCodeGenConfig(
        stage_config=pipeline,
        search_config=search_config,
        domain_setup=domain_setup,
    )


def _make_search_engine() -> MagicMock:
    se = MagicMock()
    se.indices_by_name.return_value = set()
    se.indices_by_category.return_value = set()
    se.indices_by_repo.return_value = set()
    se.indices_by_type.return_value = set()
    se.indices_by_owner_class.return_value = set()
    return se


class TestDriverAgentInit:
    def test_creates_default_domain_setup_if_none(self):
        rc = _make_runtime_config(domain_setup=None)
        agent = DriverAgent(runtime_config=rc, search_engine=_make_search_engine())
        assert agent._domain_setup.name == "empty_default"

    def test_uses_provided_domain_setup(self):
        ds = CodegenDomainSetup("mydomain")
        rc = _make_runtime_config(domain_setup=ds)
        agent = DriverAgent(runtime_config=rc, search_engine=_make_search_engine())
        assert agent._domain_setup is ds


# ----------------------------- _resolve_include_entries -----------------------------


class TestResolveIncludeEntries:
    def _make_agent(self) -> DriverAgent:
        return DriverAgent(
            runtime_config=_make_runtime_config(),
            search_engine=_make_search_engine(),
        )

    def test_by_api_names_unions_lookups(self):
        agent = self._make_agent()
        agent.search_engine.indices_by_name.side_effect = lambda name: (
            {1, 2} if name == "a" else {3} if name == "b" else set()
        )
        entries = [IncludeEntry.by_api_names("a", "b")]
        result = agent._resolve_include_entries(entries)
        assert result == {1, 2, 3}

    def test_by_category(self):
        agent = self._make_agent()
        agent.search_engine.indices_by_category.return_value = {10, 11}
        entries = [IncludeEntry.by_category("usecases")]
        result = agent._resolve_include_entries(entries)
        assert result == {10, 11}

    def test_by_repo(self):
        agent = self._make_agent()
        agent.search_engine.indices_by_repo.return_value = {7}
        entries = [IncludeEntry.by_repo("repo1")]
        result = agent._resolve_include_entries(entries)
        assert result == {7}

    def test_refinement_intersects_category(self):
        agent = self._make_agent()
        agent.search_engine.indices_by_name.return_value = {1, 2, 3}
        agent.search_engine.indices_by_category.return_value = {2, 3, 4}
        entries = [IncludeEntry.by_api_names("x").in_category("usecases")]
        result = agent._resolve_include_entries(entries)
        assert result == {2, 3}

    def test_refinement_intersects_type(self):
        agent = self._make_agent()
        agent.search_engine.indices_by_name.return_value = {1, 2, 3}
        agent.search_engine.indices_by_type.return_value = {1, 3}
        entries = [IncludeEntry.by_api_names("x").of_type(EntryKind.METHOD)]
        result = agent._resolve_include_entries(entries)
        assert result == {1, 3}

    def test_refinement_intersects_owner_class(self):
        agent = self._make_agent()
        agent.search_engine.indices_by_name.return_value = {1, 2, 3}
        agent.search_engine.indices_by_type.return_value = {1, 2, 3}
        agent.search_engine.indices_by_owner_class.return_value = {2}
        entries = [
            IncludeEntry.by_api_names("x")
            .of_type(EntryKind.METHOD)
            .belongs_to_class("Cls")
        ]
        result = agent._resolve_include_entries(entries)
        assert result == {2}


# ----------------------------- Hook resolution -----------------------------


class TestResolveIncludeEntryHooks:
    def _agent_with_force_hooks(self, hooks: list) -> DriverAgent:
        ds = CodegenDomainSetup("d")
        for h in hooks:
            ds.register_force_include_entry_hook(h)
        rc = _make_runtime_config(domain_setup=ds)
        return DriverAgent(runtime_config=rc, search_engine=_make_search_engine())

    def test_no_hooks_returns_empty_set(self):
        agent = self._agent_with_force_hooks([])
        assert agent._resolve_include_entry_hooks("a", "i") == set()

    def test_collects_indices_from_hook(self):
        def hook(analysis: str, input_text: str):
            return [IncludeEntry.by_api_names("foo")]

        agent = self._agent_with_force_hooks([hook])
        agent.search_engine.indices_by_name.return_value = {42}
        assert agent._resolve_include_entry_hooks("a", "i") == {42}

    def test_rejects_invalid_return_type(self):
        def bad_hook(analysis: str, input_text: str):
            return ["not an IncludeEntry"]

        agent = self._agent_with_force_hooks([bad_hook])
        with pytest.raises(CallbackException):
            agent._resolve_include_entry_hooks("a", "i")


class TestResolvePostSearchHooks:
    def _agent_with_post_hooks(self, hooks: list) -> DriverAgent:
        ds = CodegenDomainSetup("d")
        for h in hooks:
            ds.register_post_search_enricher_hook(h)
        rc = _make_runtime_config(domain_setup=ds)
        return DriverAgent(runtime_config=rc, search_engine=_make_search_engine())

    def test_no_hooks_returns_empty_set(self):
        agent = self._agent_with_post_hooks([])
        assert agent._resolve_post_search_enricher_hooks("a", "i", set()) == set()

    def test_collects_indices(self):
        def hook(analysis: str, input_text: str, selected_apis: set):
            return [IncludeEntry.by_api_names("z")]

        agent = self._agent_with_post_hooks([hook])
        agent.search_engine.indices_by_name.return_value = {7, 8}
        result = agent._resolve_post_search_enricher_hooks("a", "i", set())
        assert result == {7, 8}

    def test_rejects_invalid_return_type(self):
        def bad_hook(analysis: str, input_text: str, selected_apis: set):
            return [object()]

        agent = self._agent_with_post_hooks([bad_hook])
        with pytest.raises(CallbackException):
            agent._resolve_post_search_enricher_hooks("a", "i", set())
