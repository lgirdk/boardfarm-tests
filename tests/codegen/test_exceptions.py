"""Tests for src/codegen/exceptions.py."""

from __future__ import annotations

import pytest

from boardfarm_api.ai_engine.codegen.exceptions import (
    CallbackException,
    CodegenException,
    IncludeEntryConfigChainError,
    ProtocolException,
)


class TestCodegenExceptions:
    @pytest.mark.parametrize(
        "exc_cls",
        [
            CodegenException,
            CallbackException,
            IncludeEntryConfigChainError,
            ProtocolException,
        ],
    )
    def test_is_exception_subclass(self, exc_cls):
        assert issubclass(exc_cls, Exception)

    @pytest.mark.parametrize(
        "exc_cls",
        [
            CodegenException,
            CallbackException,
            IncludeEntryConfigChainError,
            ProtocolException,
        ],
    )
    def test_can_be_raised_and_caught(self, exc_cls):
        with pytest.raises(exc_cls, match="boom"):
            raise exc_cls("boom")

    def test_exceptions_are_distinct_types(self):
        # None inherits from each other (other than from Exception)
        assert not issubclass(CallbackException, CodegenException)
        assert not issubclass(IncludeEntryConfigChainError, CodegenException)
        assert not issubclass(ProtocolException, CodegenException)
