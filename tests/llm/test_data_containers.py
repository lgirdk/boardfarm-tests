"""Tests for src/llm/data_containers.py."""

from __future__ import annotations

import pytest

from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings, ParamType, ToolDefinition


class TestParamType:
    def test_str_values(self):
        assert ParamType.STR == "str"
        assert ParamType.INT == "int"
        assert ParamType.LIST_STR == "list[str]"


class TestToolDefinition:
    def test_create(self):
        t = ToolDefinition(
            name="get_thing",
            description="Get a thing",
            input_schema={"type": "object", "properties": {}},
        )
        assert t.name == "get_thing"
        assert t.input_schema["type"] == "object"


class TestLLMCallSettings:
    def test_defaults(self):
        s = LLMCallSettings()
        assert s.temperature == 0.7
        assert s.max_tokens == 4096
        assert s.seed is None
        assert s.response_schema is None
        assert s.stop is None

    def test_overrides(self):
        s = LLMCallSettings(temperature=0.1, max_tokens=100, seed=42, stop=["END"])
        assert s.temperature == 0.1
        assert s.max_tokens == 100
        assert s.seed == 42
        assert s.stop == ["END"]

    def test_extra_forbidden(self):
        with pytest.raises(Exception):  # noqa: B017
            LLMCallSettings(unexpected="x")
