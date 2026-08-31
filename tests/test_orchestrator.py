"""Tests for src/orchestrator.py.

Covers the pydantic config validators on AppConfig / SearchStoreConfigPath /
CodegenConfigPath, the auto-registration of LLM clients on import, and the
end-to-end Orchestrator.__init__ wiring (with shared services and CodegenApp
build all mocked out so no real LLM/network/filesystem heavy lifting happens).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from boardfarm_api.ai_engine.llm import LLM_CLIENT_REGISTRY
from boardfarm_api.ai_engine.engine import (
    AppConfig,
    CodegenConfigPath,
    Orchestrator,
    SearchStoreConfigPath,
)

# ----------------------------- SearchStoreConfigPath -----------------------------


class TestSearchStoreConfigPath:
    def test_existing_path_ok(self, tmp_path):
        f = tmp_path / "store.toml"
        f.write_text("")
        cfg = SearchStoreConfigPath(store_config_path=f)
        assert cfg.store_config_path == f

    def test_missing_path_rejected(self, tmp_path):
        with pytest.raises(Exception, match="does not exist"):
            SearchStoreConfigPath(store_config_path=tmp_path / "missing.toml")


# ----------------------------- CodegenConfigPath -----------------------------


class TestCodegenConfigPath:
    def _make_paths(self, tmp_path: Path):
        pc = tmp_path / "pipeline.toml"
        pc.write_text("")
        sc = tmp_path / "search.toml"
        sc.write_text("")
        return pc, sc

    def test_minimal_valid(self, tmp_path):
        pc, sc = self._make_paths(tmp_path)
        cfg = CodegenConfigPath(pipeline_config_path=pc, search_settings_path=sc)
        assert cfg.pipeline_config_path == pc
        assert cfg.search_settings_path == sc

    def test_missing_pipeline_path_rejected(self, tmp_path):
        _, sc = self._make_paths(tmp_path)
        with pytest.raises(Exception, match="does not exist"):
            CodegenConfigPath(
                pipeline_config_path=tmp_path / "no.toml", search_settings_path=sc
            )

    def test_missing_search_settings_path_rejected(self, tmp_path):
        pc, _ = self._make_paths(tmp_path)
        with pytest.raises(Exception, match="does not exist"):
            CodegenConfigPath(
                pipeline_config_path=pc, search_settings_path=tmp_path / "no.toml"
            )

    def test_extra_fields_forbidden(self, tmp_path):
        pc, sc = self._make_paths(tmp_path)
        with pytest.raises(Exception):
            CodegenConfigPath(
                pipeline_config_path=pc,
                search_settings_path=sc,
                unexpected_field="x",
            )


# ----------------------------- AppConfig -----------------------------


class TestAppConfig:
    def test_validates_full_tree(self, tmp_path):
        store_toml = tmp_path / "store.toml"
        pipeline_toml = tmp_path / "pipeline.toml"
        search_toml = tmp_path / "search.toml"
        for p in (store_toml, pipeline_toml, search_toml):
            p.write_text("")

        cfg = AppConfig.model_validate(
            {
                "llm": {
                    "sonnet": {"model": "claude-3"},
                },
                "search_store": {"store_config_path": str(store_toml)},
                "codegen": {
                    "pipeline_config_path": str(pipeline_toml),
                    "search_settings_path": str(search_toml),
                },
            }
        )
        assert "sonnet" in cfg.llm


# ----------------------------- LLM auto-registration on import -----------------------------


class TestLLMRegistryAutoRegistration:
    """Importing src.orchestrator should register the built-in LLM clients."""

    def test_built_in_clients_registered(self):
        for name in ("sonnet", "custome_gpt4o", "openai_llm", "gemma4_26B_8bit"):
            assert name in LLM_CLIENT_REGISTRY, (
                f"'{name}' should be auto-registered when orchestrator is imported"
            )

    def test_registry_get_returns_class(self):
        from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

        assert LLM_CLIENT_REGISTRY.get("sonnet") is AnthropicClient


# ----------------------------- Orchestrator.__init__ wiring -----------------------------


class TestOrchestratorInit:
    """Verify Orchestrator wires shared services and the codegen app correctly."""

    def _write_minimal_app_toml(self, tmp_path: Path) -> Path:
        store_toml = tmp_path / "store.toml"
        pipeline_toml = tmp_path / "pipeline.toml"
        search_toml = tmp_path / "search.toml"
        for p in (store_toml, pipeline_toml, search_toml):
            p.write_text("")

        app_toml = tmp_path / "app.toml"
        app_toml.write_text(
            f"""
[llm.sonnet]
model = "claude-3"

[search_store]
store_config_path = "{store_toml}"

[codegen]
pipeline_config_path = "{pipeline_toml}"
search_settings_path = "{search_toml}"
"""
        )
        return app_toml

    def test_init_builds_services_and_codegen_app(self, tmp_path):
        app_toml = self._write_minimal_app_toml(tmp_path)

        fake_search_store = MagicMock(name="SearchStoreService_instance")
        fake_codegen_app = MagicMock(name="CodegenApp_instance")

        with (
            patch(
                "boardfarm_api.ai_engine.engine.SearchStoreService.from_toml",
                return_value=fake_search_store,
            ) as mock_search_from_toml,
            patch(
                "boardfarm_api.ai_engine.engine.CodegenApp.build",
                return_value=fake_codegen_app,
            ) as mock_codegen_build,
        ):
            orc = Orchestrator(app_toml)

        assert orc.search_store_service is fake_search_store
        assert orc.codegen_app is fake_codegen_app
        assert orc.llm_pool is not None

        mock_search_from_toml.assert_called_once()
        assert mock_search_from_toml.call_args.kwargs["path"] == (
            tmp_path / "store.toml"
        )

        mock_codegen_build.assert_called_once()
        kwargs = mock_codegen_build.call_args.kwargs
        assert kwargs["pipeline_config_toml_path"] == tmp_path / "pipeline.toml"
        assert kwargs["search_config_toml_path"] == tmp_path / "search.toml"
        assert kwargs["search_store"] is fake_search_store
        assert kwargs["llm_pool"] is orc.llm_pool

    def test_init_missing_app_config_path_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            Orchestrator(tmp_path / "does_not_exist.toml")

    def test_init_propagates_invalid_app_toml(self, tmp_path):
        app_toml = tmp_path / "app.toml"
        app_toml.write_text('[llm.sonnet]\nmodel = "x"\n')
        with pytest.raises(Exception):
            Orchestrator(app_toml)
