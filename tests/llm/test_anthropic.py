"""Tests for src/llm/anthropic.py (with mocked Anthropic SDK)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from boardfarm_api.ai_engine.llm.config_schema import LLMConfig
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings


class TestAnthropicClient:
    def _make_response(self, text: str, block_type: str = "text"):
        block = MagicMock()
        block.type = block_type
        block.text = text
        resp = MagicMock()
        resp.content = [block]
        return resp

    def test_init_creates_anthropic_client(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic") as MockA,
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            client = AnthropicClient(model="claude-3", api_key="sk-123")
            assert client.model == "claude-3"
            MockA.assert_called_once()
            kwargs = MockA.call_args.kwargs
            assert kwargs["api_key"] == "sk-123"

    def test_call_returns_text(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic") as MockA,
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            api_instance = MockA.return_value
            api_instance.messages.create.return_value = self._make_response("hello!")

            client = AnthropicClient(model="claude-3")
            out = client.call("sys", "usr")
            assert out == "hello!"

            create_kwargs = api_instance.messages.create.call_args.kwargs
            assert create_kwargs["model"] == "claude-3"
            assert create_kwargs["system"] == "sys"
            assert create_kwargs["messages"] == [{"role": "user", "content": "usr"}]

    def test_call_uses_provided_settings(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic") as MockA,
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            api_instance = MockA.return_value
            api_instance.messages.create.return_value = self._make_response("ok")

            client = AnthropicClient(model="claude-3")
            settings = LLMCallSettings(temperature=0.1, max_tokens=500)
            client.call("s", "u", settings=settings)
            create_kwargs = api_instance.messages.create.call_args.kwargs
            assert create_kwargs["temperature"] == 0.1
            assert create_kwargs["max_tokens"] == 500

    def test_call_uses_default_settings_when_none(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic") as MockA,
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            api_instance = MockA.return_value
            api_instance.messages.create.return_value = self._make_response("ok")

            client = AnthropicClient(model="claude-3")
            client.call("s", "u")
            create_kwargs = api_instance.messages.create.call_args.kwargs
            # Defaults from LLMCallSettings
            assert create_kwargs["temperature"] == 0.7
            assert create_kwargs["max_tokens"] == 4096

    def test_call_raises_on_non_text_block(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic") as MockA,
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            api_instance = MockA.return_value
            api_instance.messages.create.return_value = self._make_response(
                "", block_type="image"
            )

            client = AnthropicClient(model="claude-3")
            with pytest.raises(TypeError, match="Expected text block"):
                client.call("s", "u")

    def test_get_model_name(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic"),
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            assert AnthropicClient(model="m1").get_model_name() == "m1"

    def test_supports_tools_false(self):
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic"),
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            assert AnthropicClient(model="m1").supports_tools is False

    def test_from_config_reads_env_var(self, monkeypatch):
        monkeypatch.setenv("MY_KEY", "secret-key-x")
        with (
            patch("boardfarm_api.ai_engine.llm.anthropic.Anthropic") as MockA,
            patch("boardfarm_api.ai_engine.llm.anthropic.httpx.Client"),
        ):
            from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient

            cfg = LLMConfig(model="m1", api_key_env="MY_KEY")
            AnthropicClient.from_config(cfg)
            assert MockA.call_args.kwargs["api_key"] == "secret-key-x"
