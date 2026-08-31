"""Tests for src/codegen/code_generator.py."""

from __future__ import annotations

from unittest.mock import MagicMock

from boardfarm_api.api.schemas.codegen import CodegenTextInput
from boardfarm_api.ai_engine.codegen.code_generator import generate_code
from boardfarm_api.ai_engine.codegen.data_models import (
    CodeGenContext,
    CodegenDomainSetup,
    CodegenPromptPair,
    ResolvedStage,
)
from boardfarm_api.ai_engine.codegen.enums import CodegenPromptVariant
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings


class TestGenerateCode:
    def _make_inputs(self, llm_response: str = "GENERATED_CODE"):
        llm = MagicMock()
        llm.call.return_value = llm_response
        stage = ResolvedStage(
            llm=llm,
            settings=LLMCallSettings(temperature=0.2, max_tokens=4096),
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
        )
        ctx = CodeGenContext(
            input_object=CodegenTextInput(name="t", text="body"),
            analysis="THE_ANALYSIS",
            retrieved_entries=["entry1", "entry2"],
            example_test="",
        )
        prompt_pair = CodegenPromptPair(
            system_prompt=(
                "sys analysis={analysis} entries={retrieved_entries} "
                "example={example_test} dk={domain_knowledge} fr={framework_rules}"
            ),
            user_prompt="usr input={input_text}",
        )
        ds = CodegenDomainSetup("d")
        ds.set_domain_knowledge("KNOW")
        ds.set_framework_rules("RULES")
        return stage, ctx, prompt_pair, ds, llm

    def test_returns_llm_response(self):
        stage, ctx, pair, ds, _llm = self._make_inputs("code!")
        out = generate_code(stage, ctx, pair, ds)
        assert out == "code!"

    def test_substitutes_all_variables(self):
        stage, ctx, pair, ds, llm = self._make_inputs()
        generate_code(stage, ctx, pair, ds)
        call = llm.call.call_args
        sys_prompt = call.kwargs["system"]
        assert "THE_ANALYSIS" in sys_prompt
        assert "entry1\n\nentry2" in sys_prompt
        assert "KNOW" in sys_prompt
        assert "RULES" in sys_prompt

    def test_uses_no_example_placeholder_when_empty(self):
        stage, ctx, pair, ds, llm = self._make_inputs()
        generate_code(stage, ctx, pair, ds)
        sys_prompt = llm.call.call_args.kwargs["system"]
        assert "No example available." in sys_prompt

    def test_uses_example_when_provided(self):
        stage, ctx, pair, ds, llm = self._make_inputs()
        ctx.example_test = "EXAMPLE TEST CODE"
        generate_code(stage, ctx, pair, ds)
        sys_prompt = llm.call.call_args.kwargs["system"]
        assert "EXAMPLE TEST CODE" in sys_prompt

    def test_passes_user_input(self):
        stage, ctx, pair, ds, llm = self._make_inputs()
        generate_code(stage, ctx, pair, ds)
        user_prompt = llm.call.call_args.kwargs["user"]
        assert "body" in user_prompt
        assert "TASK: t" in user_prompt

    def test_passes_settings(self):
        stage, ctx, pair, ds, llm = self._make_inputs()
        generate_code(stage, ctx, pair, ds)
        assert llm.call.call_args.kwargs["settings"] is stage.settings
