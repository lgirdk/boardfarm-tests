from abc import ABC, abstractmethod
from typing import Self

from .config_schema import LLMConfig
from .data_containers import LLMCallSettings, ToolDefinition

PARAM_TYPE_MAP = {
    "str": {"type": "string"},
    "int": {"type": "integer"},
    "float": {"type": "number"},
    "bool": {"type": "boolean"},
    "dict": {"type": "object"},
    "list": {"type": "array"},
    "list[str]": {"type": "array", "items": {"type": "string"}},
    "list[int]": {"type": "array", "items": {"type": "integer"}},
    "list[float]": {"type": "array", "items": {"type": "number"}},
    "list[bool]": {"type": "array", "items": {"type": "boolean"}},
    "list[dict]": {"type": "array", "items": {"type": "object"}},
}


class LLMClientTemplate(ABC):
    """Base for all LLM client implementations."""

    @abstractmethod
    def call(
        self, system: str, user: str, settings: LLMCallSettings | None = None
    ) -> str:
        """Single turn. System + user prompt in, text out.
        If settings.response_schema is set, output is constrained
        but still returned as str."""
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the model identifier."""
        ...

    @classmethod
    @abstractmethod
    def from_config(cls, cfg: LLMConfig) -> Self:
        """Build client from config."""
        ...

    def call_with_history(
        self,
        system: str,
        messages: list[dict],
        settings: LLMCallSettings | None = None,
    ) -> str:
        """Multi-turn. System + message history in, text out."""
        raise NotImplementedError(
            f"{type(self).__name__} does not support multi-turn calls"
        )

    def call_with_tools(
        self,
        system: str,
        user: str,
        tools: list[ToolDefinition],
        settings: LLMCallSettings | None = None,
    ) -> list[dict]:
        """Tool calling. Returns list of tool call dicts with name, input, id."""
        raise NotImplementedError(
            f"{type(self).__name__} does not support tool calling"
        )
