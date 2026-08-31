"""Tests for src/codegen/protocols.py."""

from __future__ import annotations

from boardfarm_api.ai_engine.codegen.protocols import ForceIncludeEntryHook, PostSearchEnricherHook


class TestForceIncludeEntryHook:
    def test_runtime_checkable_accepts_matching_callable(self):
        def hook(analysis: str, input_text: str) -> list:
            return []

        assert isinstance(hook, ForceIncludeEntryHook)

    def test_rejects_non_callable(self):
        assert not isinstance("not a callable", ForceIncludeEntryHook)
        assert not isinstance(42, ForceIncludeEntryHook)


class TestPostSearchEnricherHook:
    def test_runtime_checkable_accepts_matching_callable(self):
        def hook(analysis: str, input_text: str, selected_apis: set) -> list:
            return []

        assert isinstance(hook, PostSearchEnricherHook)

    def test_rejects_non_callable(self):
        assert not isinstance(None, PostSearchEnricherHook)
