from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict


class ParamType(StrEnum):
    STR = "str"
    INT = "int"
    FLOAT = "float"
    BOOL = "bool"
    DICT = "dict"
    LIST = "list"
    LIST_STR = "list[str]"
    LIST_INT = "list[int]"
    LIST_FLOAT = "list[float]"
    LIST_BOOL = "list[bool]"
    LIST_DICT = "list[dict]"


class ToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any]  # raw JSON Schema — universal, no custom enum needed


class LLMCallSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temperature: float = 0.7
    max_tokens: int = 4096
    seed: int | None = None
    response_schema: dict | None = None
    stop: list[str] | None = None
