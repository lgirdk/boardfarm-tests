"""Tests for src/codegen/reasoning.py."""

from __future__ import annotations

from unittest.mock import MagicMock

from boardfarm_api.api.schemas.codegen import CodegenTextInput
from boardfarm_api.ai_engine.codegen.data_models import (
    CodegenDomainSetup,
    CodegenPromptPair,
    ResolvedStage,
)
from boardfarm_api.ai_engine.codegen.enums import (
    CodegenOutputType,
    CodegenPromptStage,
    CodegenPromptVariant,
)
from boardfarm_api.ai_engine.codegen.reasoning import _validate, run_reasoning
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings


class TestRunReasoning:
    def _make_stage_and_setup(self, llm_response: str = "the analysis"):
        llm = MagicMock()
        llm.call.return_value = llm_response

        stage = ResolvedStage(
            llm=llm,
            settings=LLMCallSettings(temperature=0.5, max_tokens=512),
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
        )

        prompt_mgr = MagicMock()
        prompt_mgr.resolve_prompt.return_value = CodegenPromptPair(
            system_prompt="SYS knows={domain_knowledge}",
            user_prompt="USR input={input_text}",
        )

        ds = CodegenDomainSetup("d")
        ds.set_domain_knowledge("KNOW")

        return stage, prompt_mgr, ds, llm

    def test_returns_llm_response(self):
        stage, mgr, ds, _llm = self._make_stage_and_setup("the analysis")
        input_ = CodegenTextInput(name="t", text="raw")
        out = run_reasoning(
            stage,
            input_,
            mgr,
            CodegenOutputType.PYTEST,
            ds,
        )
        assert out == "the analysis"

    def test_resolves_correct_prompt_key(self):
        stage, mgr, ds, _llm = self._make_stage_and_setup()
        input_ = CodegenTextInput(name="t", text="raw")
        run_reasoning(stage, input_, mgr, CodegenOutputType.PYTEST, ds)
        mgr.resolve_prompt.assert_called_once_with(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
            output_type=CodegenOutputType.PYTEST,
        )

    def test_passes_formatted_system_user_to_llm(self):
        stage, mgr, ds, llm = self._make_stage_and_setup()
        input_ = CodegenTextInput(name="t", text="raw body")
        run_reasoning(stage, input_, mgr, CodegenOutputType.PYTEST, ds)
        call = llm.call.call_args
        assert "KNOW" in call.kwargs["system"]
        assert "raw body" in call.kwargs["user"]
        assert call.kwargs["settings"] is stage.settings


class TestValidate:
    def test_empty_text_returns_too_short(self):
        issues = _validate("", "")
        assert any("too short" in i.lower() for i in issues)

    def test_short_text_returns_too_short(self):
        issues = _validate("only a few words", "step1\nstep2")
        assert any("too short" in i.lower() for i in issues)

    def test_long_text_no_issues_on_meaningless_short_steps(self):
        # _validate iterates test_steps as a string (per-char) when test_steps is a str.
        # Use a very long reasoning that has plenty of unique words.
        words = " ".join(f"word{i}" for i in range(100))
        issues = _validate(words, "")
        # may report "too generic" if reasoning_only_words count < 30; with 100 unique words
        # should not be generic
        assert not any("generic" in i.lower() for i in issues)
