"""Tests for src/codegen/config_schema.py.

Exercises pydantic validation, TOML loading, and selector/profile resolution.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from boardfarm_api.ai_engine.codegen.config_schema import (
    CodeGenPipelineConfig,
    CodegenSearchSettings,
    StageConfig,
    StageSettings,
    _SubCorpusGroupConfig,
)
from boardfarm_api.ai_engine.codegen.enums import CodegenPromptVariant
from boardfarm_api.ai_engine.search_store.data_models import ParsedKey

# ----------------------------- StageConfig / StageSettings -----------------------------


class TestStageConfigAndSettings:
    def test_stage_config_valid(self):
        sc = StageConfig(llm="sonnet", profile="default")
        assert sc.llm == "sonnet"
        assert sc.profile == "default"

    def test_stage_config_extra_forbidden(self):
        with pytest.raises(Exception):  # noqa: B017
            StageConfig(llm="x", profile="y", extra="z")

    def test_stage_settings_valid(self):
        s = StageSettings(temperature=0.5, max_tokens=2048)
        assert s.temperature == 0.5
        assert s.max_tokens == 2048


# ----------------------------- CodeGenPipelineConfig -----------------------------


def _write_pipeline_toml(path: Path) -> Path:
    """Minimal valid pipeline config TOML."""
    path.write_text(
        """
domain_setup_entrypoint = ""

[stages]
reasoning = {llm = "sonnet", profile = "default"}
search = {llm = "sonnet", profile = "default"}
generation = {llm = "sonnet", profile = "default"}

[profiles.default]
description = "default"
compatible_models = ["sonnet"]
prompt_variant = "standard"
reasoning = {temperature = 0.7, max_tokens = 1024}
search = {temperature = 0.4, max_tokens = 2048}
generation = {temperature = 0.2, max_tokens = 4096}
"""
    )
    return path


class TestCodeGenPipelineConfig:
    def test_load_from_toml_valid(self, tmp_path: Path):
        p = _write_pipeline_toml(tmp_path / "codegen.toml")
        cfg = CodeGenPipelineConfig.load_from_toml(p)
        assert isinstance(cfg.stages.reasoning, StageConfig)
        assert (
            cfg.profiles["default"].prompt_variant
            == CodegenPromptVariant.STANDARD_BIG_MODELS
        )

    def test_stage_names(self):
        names = CodeGenPipelineConfig.stage_names()
        assert names == {"reasoning", "search", "generation"}

    def test_unknown_profile_rejected(self, tmp_path: Path):
        p = tmp_path / "bad.toml"
        p.write_text(
            """
domain_setup_entrypoint = ""

[stages]
reasoning = {llm = "x", profile = "missing"}
search = {llm = "x", profile = "default"}
generation = {llm = "x", profile = "default"}

[profiles.default]
description = "d"
compatible_models = ["x"]
prompt_variant = "standard"
reasoning = {temperature = 0.5, max_tokens = 100}
search = {temperature = 0.5, max_tokens = 100}
generation = {temperature = 0.5, max_tokens = 100}
"""
        )
        with pytest.raises(Exception, match="unknown profile"):
            CodeGenPipelineConfig.load_from_toml(p)


# ----------------------------- _SubCorpusGroupConfig -----------------------------


class TestSubCorpusGroupConfig:
    def _make(self, **overrides) -> _SubCorpusGroupConfig:
        defaults = {
            "categories": [],
            "repos": [],
            "module_patterns": [],
        }
        defaults.update(overrides)
        return _SubCorpusGroupConfig(**defaults)

    def test_at_least_one_selector_required(self):
        with pytest.raises(Exception, match="At least one"):
            self._make()  # all empty

    def test_categories_only(self):
        cfg = self._make(categories=["x"])
        assert cfg.categories == ["x"]

    def test_build_selector_categories_only(self):
        cfg = self._make(categories=["usecases"])
        sel = cfg.build_selector()
        pk_match = ParsedKey(
            raw_key="r@f::usecases::n",
            root_index_key="r@f::usecases::n",
            repo="r",
            file_key="f",
            category="usecases",
            callable_name="n",
        )
        pk_other = ParsedKey(
            raw_key="r@f::templates::n",
            root_index_key="r@f::templates::n",
            repo="r",
            file_key="f",
            category="templates",
            callable_name="n",
        )
        assert sel(pk_match) is True
        assert sel(pk_other) is False

    def test_build_selector_combines_multiple_with_and(self):
        cfg = self._make(categories=["usecases"], repos=["repo1"])
        sel = cfg.build_selector()
        pk_both = ParsedKey(
            raw_key="repo1@f::usecases::n",
            root_index_key="repo1@f::usecases::n",
            repo="repo1",
            file_key="f",
            category="usecases",
            callable_name="n",
        )
        pk_one = ParsedKey(
            raw_key="other@f::usecases::n",
            root_index_key="other@f::usecases::n",
            repo="other",
            file_key="f",
            category="usecases",
            callable_name="n",
        )
        assert sel(pk_both) is True
        assert sel(pk_one) is False


# ----------------------------- CodegenSearchSettings -----------------------------


class TestCodegenSearchSettings:
    def test_load_from_toml(self, tmp_path: Path):
        p = tmp_path / "search.toml"
        p.write_text(
            """
encoder = "bge"

[strategy]
keep_rounds = 2
remove_rounds = 1

[full_corpus]
search_enabled = true

[sub_corpus_group.usecases]
categories = ["usecases"]
repos = []
module_patterns = []
"""
        )
        cfg = CodegenSearchSettings.load_from_toml(p)
        assert cfg.encoder == "bge"
        assert cfg.strategy.keep_rounds == 2
        assert cfg.strategy.remove_rounds == 1
        assert "usecases" in cfg.sub_corpus_group
