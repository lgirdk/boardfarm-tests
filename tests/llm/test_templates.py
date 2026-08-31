"""Tests for src/llm/templates.py."""

from __future__ import annotations

import pytest

from boardfarm_api.ai_engine.llm.config_schema import LLMConfig
from boardfarm_api.ai_engine.llm.templates import PARAM_TYPE_MAP, LLMClientTemplate


class TestParamTypeMap:
    def test_basic_types(self):
        assert PARAM_TYPE_MAP["str"] == {"type": "string"}
        assert PARAM_TYPE_MAP["int"] == {"type": "integer"}
        assert PARAM_TYPE_MAP["float"] == {"type": "number"}
        assert PARAM_TYPE_MAP["bool"] == {"type": "boolean"}
        assert PARAM_TYPE_MAP["dict"] == {"type": "object"}

    def test_list_types(self):
        assert PARAM_TYPE_MAP["list"] == {"type": "array"}
        assert PARAM_TYPE_MAP["list[str]"] == {
            "type": "array",
            "items": {"type": "string"},
        }
        assert PARAM_TYPE_MAP["list[int]"] == {
            "type": "array",
            "items": {"type": "integer"},
        }


class _ConcreteClient(LLMClientTemplate):
    """Minimal concrete implementation for testing."""

    def __init__(self, name: str = "test-model"):
        self.name = name

    def call(self, system, user, settings=None):
        return f"sys={system}|usr={user}"

    def get_model_name(self):
        return self.name

    @classmethod
    def from_config(cls, cfg):
        return cls(name=cfg.model)


class TestLLMClientTemplate:
    def test_abstract_methods_block_direct_instantiation(self):
        with pytest.raises(TypeError):
            LLMClientTemplate()  # type: ignore[abstract]

    def test_concrete_subclass_works(self):
        c = _ConcreteClient(name="m1")
        assert c.get_model_name() == "m1"
        assert c.call("s", "u") == "sys=s|usr=u"

    def test_from_config_classmethod(self):
        cfg = LLMConfig(model="m42")
        c = _ConcreteClient.from_config(cfg)
        assert c.get_model_name() == "m42"

    def test_call_with_history_default_raises(self):
        c = _ConcreteClient()
        with pytest.raises(NotImplementedError, match="multi-turn"):
            c.call_with_history("s", [{"role": "user", "content": "x"}])

    def test_call_with_tools_default_raises(self):
        c = _ConcreteClient()
        with pytest.raises(NotImplementedError, match="tool calling"):
            c.call_with_tools("s", "u", tools=[])
