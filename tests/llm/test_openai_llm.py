"""Tests for src/llm/openai_llm.py (with mocked OpenAI SDK)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from boardfarm_api.ai_engine.llm.config_schema import LLMConfig


def _make_chat_response(content: str | None):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


class TestOpenAIClient:
    def test_init(self):
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI") as MockO:
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            client = OpenAIClient(model="gpt-4o", base_url="https://x.com", api_key="k")
            assert client.model == "gpt-4o"
            MockO.assert_called_once_with(base_url="https://x.com", api_key="k")

    def test_init_uses_dummy_key_if_none(self):
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI") as MockO:
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            OpenAIClient(model="gpt-4o")
            MockO.assert_called_once_with(base_url=None, api_key="not-needed")

    def test_call_returns_content(self):
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI") as MockO:
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            api = MockO.return_value
            api.chat.completions.create.return_value = _make_chat_response("hi there")

            client = OpenAIClient(model="gpt-4o")
            out = client.call("sys", "usr")
            assert out == "hi there"

            create_kwargs = api.chat.completions.create.call_args.kwargs
            assert create_kwargs["model"] == "gpt-4o"
            assert create_kwargs["messages"] == [
                {"role": "system", "content": "sys"},
                {"role": "user", "content": "usr"},
            ]

    def test_call_returns_empty_when_content_none(self):
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI") as MockO:
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            api = MockO.return_value
            api.chat.completions.create.return_value = _make_chat_response(None)

            client = OpenAIClient(model="gpt-4o")
            assert client.call("s", "u") == ""

    def test_get_model_name(self):
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI"):
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            assert OpenAIClient(model="m").get_model_name() == "m"

    def test_supports_tools_false(self):
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI"):
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            assert OpenAIClient(model="m").supports_tools is False

    def test_from_config_reads_env(self, monkeypatch):
        monkeypatch.setenv("MY_OPENAI_KEY", "sk-x")
        with patch("boardfarm_api.ai_engine.llm.openai_llm.OpenAI") as MockO:
            from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient

            cfg = LLMConfig(
                model="m",
                endpoint="https://api.openai.com",
                api_key_env="MY_OPENAI_KEY",
            )
            OpenAIClient.from_config(cfg)
            kwargs = MockO.call_args.kwargs
            assert kwargs["api_key"] == "sk-x"
            assert kwargs["base_url"].startswith("https://api.openai.com")
