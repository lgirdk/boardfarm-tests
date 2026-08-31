"""Tests for src/search_store/config_schema.py."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from boardfarm_api.ai_engine.search_store.config_schema import (
    StoreConfig,
    _OpenAIEncoderConfig,
    _SentenceTransformerConfig,
    _StubRegistryConfig,
)


def _write_config_toml(
    tmp_path: Path, stub_index_path: Path, artifacts_path: Path
) -> Path:
    cfg = tmp_path / "store.toml"
    cfg.write_text(
        f"""
[store]
artifacts_path = "{artifacts_path}"

[store.stub_registry]
stub_index_path = "{stub_index_path}"

[encoders.bge]
encoder_type = "sentence_transformer"
model_path = "/some/path"
local_files_only = true
batch_size = 16

[encoders.openai_e]
encoder_type = "openai"
model = "text-embedding-3-small"
api_key_env = "OPENAI_KEY"

[filters]
repo_priority_order = ["alpha", "beta"]
exclude_repos = ["bad_repo"]
"""
    )
    return cfg


class TestStubRegistryConfig:
    def test_must_exist(self, tmp_path):
        existing = tmp_path / "x.json"
        existing.write_text("{}")
        cfg = _StubRegistryConfig(stub_index_path=existing)
        assert cfg.stub_index_path == existing

    def test_missing_path_rejected(self):
        with pytest.raises(Exception, match="does not exist"):
            _StubRegistryConfig(stub_index_path=Path("/no/such/path.json"))


class TestStoreConfig:
    def test_load_from_toml(self, tmp_path):
        stub = tmp_path / "stubs.json"
        stub.write_text("{}")
        artifacts = tmp_path / "artifacts"
        artifacts.mkdir()
        cfg_path = _write_config_toml(tmp_path, stub, artifacts)
        cfg = StoreConfig.from_toml(cfg_path)
        assert cfg.store.stub_registry.stub_index_path == stub
        assert "bge" in cfg.encoders
        assert "openai_e" in cfg.encoders
        assert cfg.filters.repo_priority_order == ["alpha", "beta"]
        assert cfg.filters.exclude_repos == ["bad_repo"]

    def test_build_encoder_unknown_name(self, tmp_path):
        stub = tmp_path / "s.json"
        stub.write_text("{}")
        artifacts = tmp_path / "a"
        artifacts.mkdir()
        cfg_path = _write_config_toml(tmp_path, stub, artifacts)
        cfg = StoreConfig.from_toml(cfg_path)
        with pytest.raises(ValueError, match="not found"):
            cfg.build_encoder("nonexistent")

    def test_build_encoder_sentence_transformer(self, tmp_path):
        stub = tmp_path / "s.json"
        stub.write_text("{}")
        artifacts = tmp_path / "a"
        artifacts.mkdir()
        cfg_path = _write_config_toml(tmp_path, stub, artifacts)
        cfg = StoreConfig.from_toml(cfg_path)
        with patch("boardfarm_api.ai_engine.search_store.encoders.SentenceTransformer"):
            enc = cfg.build_encoder("bge")
            assert enc is not None


class TestEncoderConfigs:
    def test_sentence_transformer_defaults(self):
        c = _SentenceTransformerConfig(model_path="x")
        assert c.encoder_type == "sentence_transformer"
        assert c.batch_size == 32
        assert c.local_files_only is False
        assert c.query_prefix == ""

    def test_openai_encoder_defaults(self):
        c = _OpenAIEncoderConfig(api_key_env="K")
        assert c.encoder_type == "openai"
        assert c.model == "text-embedding-3-small"
