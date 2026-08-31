import os
from logging import getLogger
from typing import Self

from openai import OpenAI

from .config_schema import LLMConfig
from .data_containers import LLMCallSettings
from .templates import LLMClientTemplate

LOGGEER = getLogger(__name__)


class OpenAIClient(LLMClientTemplate):
    """Works with OpenAI, and compatable apis."""

    def __init__(
        self, model: str, base_url: str | None = None, api_key: str | None = None
    ):
        self.model = model
        self.client = OpenAI(base_url=base_url, api_key=api_key or "not-needed")

    def call(
        self, system: str, user: str, settings: LLMCallSettings | None = None
    ) -> str:
        settings = settings or LLMCallSettings()
        LOGGEER.info(
            f" Default settings {settings}, curently openAI dont have any settings enabled"
        )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        resp = response.choices[0].message.content
        if resp is None:
            resp = ""
        return resp

    def get_model_name(self) -> str:
        return self.model

    @property
    def supports_tools(self) -> bool:
        return False

    @classmethod
    def from_config(cls, cfg: LLMConfig) -> Self:
        """Create an LLM client instance from a standardized LLMConfig."""

        return cls(
            model=cfg.model,
            base_url=str(cfg.endpoint),
            api_key=os.environ.get(cfg.api_key_env),
        )
