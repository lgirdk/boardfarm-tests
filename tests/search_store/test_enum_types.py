"""Tests for src/search_store/enum_types.py."""

from __future__ import annotations

from boardfarm_api.ai_engine.search_store.enum_types import MemberType


class TestMemberType:
    def test_values(self):
        assert MemberType.is_method == "method"
        assert MemberType.is_property == "property"

    def test_is_str(self):
        assert isinstance(MemberType.is_method.value, str)
