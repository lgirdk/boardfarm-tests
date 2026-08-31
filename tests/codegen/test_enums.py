"""Tests for src/codegen/enums.py."""

from __future__ import annotations

from boardfarm_api.ai_engine.codegen.enums import (
    STAGE_VARIABLES,
    CodegenOutputType,
    CodegenPromptStage,
    CodegenPromptVariant,
    EntryKind,
    IncludeEntryResolveStrategy,
)


class TestEntryKind:
    def test_values(self):
        assert EntryKind.CLASS == "class"
        assert EntryKind.FUNCTION == "function"
        assert EntryKind.METHOD == "method"
        assert EntryKind.PROPERTY == "property"

    def test_is_str_enum(self):
        # StrEnum values compare equal to str
        assert EntryKind.CLASS == "class"
        assert isinstance(EntryKind.CLASS.value, str)


class TestIncludeEntryResolveStrategy:
    def test_values(self):
        assert IncludeEntryResolveStrategy.BY_API_NAMES == "by_names"
        assert IncludeEntryResolveStrategy.BY_CATEGORY == "by_category"
        assert IncludeEntryResolveStrategy.BY_REPO == "by_repo"


class TestCodegenPromptStage:
    def test_values(self):
        assert CodegenPromptStage.REASONING == "reasoning"
        assert CodegenPromptStage.SEARCH_INITIATE == "search_initiate"
        assert CodegenPromptStage.SEARCH_KEEP == "search_keep"
        assert CodegenPromptStage.SEARCH_REMOVE == "search_remove"
        assert CodegenPromptStage.CODEGEN == "codegen"
        assert CodegenPromptStage.REVIEW == "review"


class TestCodegenPromptVariant:
    def test_values(self):
        assert CodegenPromptVariant.STANDARD_BIG_MODELS == "standard"
        assert CodegenPromptVariant.COMPACT_SMALL_MODELS == "compact"


class TestCodegenOutputType:
    def test_values(self):
        assert CodegenOutputType.PYTEST == "pytest"
        assert CodegenOutputType.ROBOT == "robot"


class TestStageVariables:
    def test_every_stage_has_an_entry(self):
        expected_stages = {
            CodegenPromptStage.REASONING,
            CodegenPromptStage.SEARCH_INITIATE,
            CodegenPromptStage.SEARCH_KEEP,
            CodegenPromptStage.SEARCH_REMOVE,
            CodegenPromptStage.CODEGEN,
            CodegenPromptStage.REVIEW,
        }
        assert set(STAGE_VARIABLES.keys()) == expected_stages

    def test_reasoning_required_vars(self):
        assert STAGE_VARIABLES[CodegenPromptStage.REASONING] == {
            "domain_knowledge",
            "framework_rules",
            "input_text",
        }

    def test_codegen_required_vars(self):
        assert "retrieved_entries" in STAGE_VARIABLES[CodegenPromptStage.CODEGEN]
        assert "example_test" in STAGE_VARIABLES[CodegenPromptStage.CODEGEN]

    def test_all_values_are_sets_of_str(self):
        for stage, vars_ in STAGE_VARIABLES.items():
            assert isinstance(vars_, set), f"{stage} should map to a set"
            assert all(isinstance(v, str) for v in vars_)
