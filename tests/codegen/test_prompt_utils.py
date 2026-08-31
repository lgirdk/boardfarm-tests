"""Tests for src/codegen/prompt/prompt_utils.py."""

from __future__ import annotations

import pytest

from boardfarm_api.ai_engine.codegen.data_models import CodegenDomainSetup, CodegenPromptPair
from boardfarm_api.ai_engine.codegen.enums import (
    CodegenOutputType,
    CodegenPromptStage,
    CodegenPromptVariant,
)
from boardfarm_api.ai_engine.codegen.prompt.prompt_utils import PromptManager


class TestPromptManager:
    def test_resolve_unknown_raises(self):
        mgr = PromptManager()
        with pytest.raises(KeyError, match="No prompt registered"):
            mgr.resolve_prompt(
                prompt_stage=CodegenPromptStage.REASONING,
                prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
                output_type=CodegenOutputType.PYTEST,
            )

    def test_load_prompts_registers_standard_pytest(self):
        mgr = PromptManager()
        mgr.load_prompts()
        pair = mgr.resolve_prompt(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
            output_type=CodegenOutputType.PYTEST,
        )
        assert isinstance(pair, CodegenPromptPair)
        assert pair.system_prompt
        assert pair.user_prompt

    def test_load_prompts_registers_compact_pytest(self):
        mgr = PromptManager()
        mgr.load_prompts()
        pair = mgr.resolve_prompt(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.COMPACT_SMALL_MODELS,
            output_type=CodegenOutputType.PYTEST,
        )
        assert isinstance(pair, CodegenPromptPair)
        assert pair.system_prompt
        assert pair.user_prompt

    def test_load_prompts_registers_all_stages_for_both_variants(self):
        """Verify each (variant, stage) combination has a registered prompt."""
        mgr = PromptManager()
        mgr.load_prompts()
        stages = [
            CodegenPromptStage.REASONING,
            CodegenPromptStage.SEARCH_INITIATE,
            CodegenPromptStage.SEARCH_KEEP,
            CodegenPromptStage.SEARCH_REMOVE,
            CodegenPromptStage.CODEGEN,
        ]
        variants = [
            CodegenPromptVariant.STANDARD_BIG_MODELS,
            CodegenPromptVariant.COMPACT_SMALL_MODELS,
        ]
        for variant in variants:
            for stage in stages:
                pair = mgr.resolve_prompt(
                    prompt_stage=stage,
                    prompt_variant=variant,
                    output_type=CodegenOutputType.PYTEST,
                )
                assert isinstance(pair, CodegenPromptPair), (
                    f"missing prompt for (variant={variant}, stage={stage})"
                )

    def test_load_prompts_registers_codegen_stage(self):
        mgr = PromptManager()
        mgr.load_prompts()
        pair = mgr.resolve_prompt(
            prompt_stage=CodegenPromptStage.CODEGEN,
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
            output_type=CodegenOutputType.PYTEST,
        )
        assert isinstance(pair, CodegenPromptPair)

    def test_load_prompts_with_domain_overrides_takes_precedence(self):
        mgr = PromptManager()
        ds = CodegenDomainSetup("d")
        ds.register_prompts(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
            output_task_type=CodegenOutputType.PYTEST,
            system_prompt="OVERRIDDEN_SYS",
            user_prompt="OVERRIDDEN_USR",
        )
        mgr.load_prompts(domain_setup=ds)
        pair = mgr.resolve_prompt(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
            output_type=CodegenOutputType.PYTEST,
        )
        assert pair.system_prompt == "OVERRIDDEN_SYS"
        assert pair.user_prompt == "OVERRIDDEN_USR"
