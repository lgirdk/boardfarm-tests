"""Tests for src/llm/custome_openi_gpt4o_client.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from boardfarm_api.ai_engine.llm.config_schema import LLMConfig
from boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client import CustomeOpenAIGPT4oClient
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings


def _make_httpx_response(content: str = "out"):
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = {"choices": [{"message": {"content": content}}]}
    return resp


class TestCustomeOpenAIGPT4oClient:
    def test_init_strips_trailing_slash(self):
        client = CustomeOpenAIGPT4oClient(
            model="m", base_url="https://api.example.com/", api_key="k"
        )
        assert client.base_url == "https://api.example.com"
        assert client.header["Authorization"] == "Bearer k"
        assert client.header["Content-Type"] == "application/json"

    def test_init_no_auth_header_without_key(self):
        client = CustomeOpenAIGPT4oClient(model="m", base_url="https://x.com")
        assert "Authorization" not in client.header

    def test_get_model_name(self):
        client = CustomeOpenAIGPT4oClient(model="m1", base_url="https://x.com")
        assert client.get_model_name() == "m1"

    def test_supports_tools_false(self):
        client = CustomeOpenAIGPT4oClient(model="m", base_url="https://x.com")
        assert client.supports_tools is False

    def test_call_sends_correct_payload(self):
        client = CustomeOpenAIGPT4oClient(model="m", base_url="https://x.com")

        with patch.object(client, "_send_with_retry") as mock_send:
            mock_send.return_value = _make_httpx_response("the answer")
            out = client.call("sys", "usr")

        assert out == "the answer"
        _headers, payload = mock_send.call_args.args
        assert payload["model"] == "m"
        assert payload["messages"] == [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "usr"},
        ]
        assert payload["temperature"] == 0.7  # default
        assert payload["max_tokens"] == 4096

    def test_call_with_seed_and_stop(self):
        client = CustomeOpenAIGPT4oClient(model="m", base_url="https://x.com")
        settings = LLMCallSettings(seed=99, stop=["END"], temperature=0.2)

        with patch.object(client, "_send_with_retry") as mock_send:
            mock_send.return_value = _make_httpx_response()
            client.call("s", "u", settings=settings)

        _, payload = mock_send.call_args.args
        assert payload["seed"] == 99
        assert payload["stop"] == ["END"]
        assert payload["temperature"] == 0.2

    def test_call_with_response_schema(self):
        client = CustomeOpenAIGPT4oClient(model="m", base_url="https://x.com")
        schema = {"name": "MyResp", "schema": {"type": "object"}}
        settings = LLMCallSettings(response_schema=schema)

        with patch.object(client, "_send_with_retry") as mock_send:
            mock_send.return_value = _make_httpx_response()
            client.call("s", "u", settings=settings)

        _, payload = mock_send.call_args.args
        assert payload["response_format"]["type"] == "json_schema"
        assert payload["response_format"]["json_schema"]["name"] == "MyResp"
        assert payload["response_format"]["json_schema"]["strict"] is True

    def test_send_with_retry_returns_response(self):
        client = CustomeOpenAIGPT4oClient(model="m", base_url="https://x.com")
        fake_resp = MagicMock(spec=httpx.Response)
        fake_resp.raise_for_status = MagicMock()

        with patch("boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client.httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = fake_resp

            out = client._send_with_retry({"h": "v"}, {"p": "v"})
            assert out is fake_resp
            instance.post.assert_called_once()

    def test_send_with_retry_retries_on_connect_error(self):
        client = CustomeOpenAIGPT4oClient(
            model="m", base_url="https://x.com", max_retries=3
        )

        ok_resp = MagicMock(spec=httpx.Response)
        ok_resp.raise_for_status = MagicMock()

        post_results = [
            httpx.ConnectError("fail"),
            httpx.ReadTimeout("timeout"),
            ok_resp,
        ]
        post_idx = {"i": 0}

        def fake_post(*a, **kw):
            r = post_results[post_idx["i"]]
            post_idx["i"] += 1
            if isinstance(r, Exception):
                raise r
            return r

        with (
            patch("boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client.httpx.Client") as MockClient,
            patch("boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client.time.sleep"),
        ):
            instance = MockClient.return_value.__enter__.return_value
            instance.post.side_effect = fake_post
            out = client._send_with_retry({}, {})
            assert out is ok_resp
            assert post_idx["i"] == 3

    def test_send_with_retry_raises_after_max(self):
        client = CustomeOpenAIGPT4oClient(
            model="m", base_url="https://x.com", max_retries=2
        )
        with (
            patch("boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client.httpx.Client") as MockClient,
            patch("boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client.time.sleep"),
        ):
            instance = MockClient.return_value.__enter__.return_value
            instance.post.side_effect = httpx.ConnectError("nope")
            with pytest.raises(httpx.ConnectError):
                client._send_with_retry({}, {})

    def test_from_config(self, monkeypatch):
        monkeypatch.setenv("GPT_KEY", "topsecret")
        cfg = LLMConfig(
            model="m",
            endpoint="https://api.example.com/v1",
            api_key_env="GPT_KEY",
        )
        client = CustomeOpenAIGPT4oClient.from_config(cfg)
        assert client.model == "m"
        assert client.api_key == "topsecret"
