import os
from typing import Self

import httpx
from anthropic import Anthropic

from .config_schema import LLMConfig
from .data_containers import LLMCallSettings
from .templates import LLMClientTemplate

# from configs.shared_state import SHARED_STATE


class AnthropicClient(LLMClientTemplate):
    """Client for Anthropic Claude API."""

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        timeout: float = 120.0,
        max_retries: int = 3,
    ):
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = Anthropic(
            api_key=api_key,  # None → reads ANTHROPIC_API_KEY from env
            timeout=timeout,
            max_retries=max_retries,  # SDK handles retry internally
            http_client=httpx.Client(verify=False),
        )

    def call(
        self, system: str, user: str, settings: LLMCallSettings | None = None
    ) -> str:
        settings = settings or LLMCallSettings()

        response = self.client.messages.create(
            model=self.model,
            max_tokens=settings.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            temperature=settings.temperature,
        )
        # response = self.client.messages.create(**kwargs)
        block = response.content[0]
        if block.type != "text":
            raise TypeError(f"Expected text block got {block.type}")
        content = block.text
        return content

    def get_model_name(self) -> str:
        return self.model

    @property
    def supports_tools(self) -> bool:
        return False

    @classmethod
    def from_config(cls, cfg: LLMConfig) -> Self:
        """Create an LLM client instance from a standardized LLMConfig."""

        return cls(model=cfg.model, api_key=os.environ.get(cfg.api_key_env))
