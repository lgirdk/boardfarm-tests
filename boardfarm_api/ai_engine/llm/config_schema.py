from pydantic import BaseModel, ConfigDict
from pydantic.networks import AnyUrl


class LLMConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    endpoint: AnyUrl | None = None
    api_key_env: str = ""
    provider: str | None = None
