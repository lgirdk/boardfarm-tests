"""Tests for src/llm/config_schema.py."""

from __future__ import annotations

import pytest

from boardfarm_api.ai_engine.llm.config_schema import LLMConfig


class TestLLMConfig:
    def test_minimal_valid(self):
        cfg = LLMConfig(model="gpt-4o")
        assert cfg.model == "gpt-4o"
        assert cfg.endpoint is None
        assert cfg.api_key_env == ""
        assert cfg.provider is None

    def test_with_endpoint(self):
        cfg = LLMConfig(model="gpt-4o", endpoint="https://api.example.com")
        assert str(cfg.endpoint).startswith("https://api.example.com")

    def test_full_fields(self):
        cfg = LLMConfig(
            model="claude-sonnet-4",
            endpoint="https://api.anthropic.com/",
            api_key_env="ANTHROPIC_API_KEY",
            provider="anthropic",
        )
        assert cfg.provider == "anthropic"
        assert cfg.api_key_env == "ANTHROPIC_API_KEY"

    def test_extra_fields_forbidden(self):
        with pytest.raises(Exception):  # noqa: B017
            LLMConfig(model="x", unexpected="y")

    def test_missing_required_model(self):
        with pytest.raises(Exception):  # noqa: B017
            LLMConfig()  # type: ignore[call-arg]

    def test_invalid_url_rejected(self):
        with pytest.raises(Exception):  # noqa: B017
            LLMConfig(model="x", endpoint="not-a-url")
