import os
import time
from typing import Self

import httpx

from .config_schema import LLMConfig
from .data_containers import LLMCallSettings
from .templates import LLMClientTemplate


class CustomeOpenAIGPT4oClient(LLMClientTemplate):
    """Client for hosted GPT4o LLM API."""

    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str | None = None,
        timeout: float = 120.0,
        max_retries: int = 3,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.header = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            self.header.update(
                {
                    "Authorization": f"Bearer {self.api_key}",
                }
            )

    def call(
        self, system: str, user: str, settings: LLMCallSettings | None = None
    ) -> str:
        settings = settings or LLMCallSettings()
        payload = {
            "model": self.model,
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if settings.seed is not None:
            payload["seed"] = settings.seed
        if settings.stop is not None:
            payload["stop"] = settings.stop
        if settings.response_schema is not None:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": settings.response_schema.get("name", "response"),
                    "strict": True,
                    "schema": settings.response_schema.get(
                        "schema", settings.response_schema
                    ),
                },
            }
        content = self._send_with_retry(self.header, payload)
        return str(content.json()["choices"][0]["message"]["content"])

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

    def _send_with_retry(self, headers: dict, payload: dict) -> httpx.Response:
        for attempt in range(self.max_retries):
            try:
                with httpx.Client(timeout=self.timeout, verify=False) as client:
                    response = client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                return response
            except (
                httpx.RemoteProtocolError,
                httpx.ConnectError,
                httpx.ReadTimeout,
            ):
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(3 * (attempt + 1))
        raise RuntimeError(f"Failed after {self.max_retries} retries")
