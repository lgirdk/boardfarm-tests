from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .registry import LLM_CLIENT_REGISTRY

if TYPE_CHECKING:
    from .config_schema import LLMConfig
    from .templates import LLMClientTemplate

LOGGER = logging.getLogger(__name__)


class LLMPool:
    """Lazy-built, cached pool of LLM client instances.

    Constructed from a mapping of {name: LLMConfig}. On first request for
    a given name, looks up the class in the registry, instantiates via
    `from_config`, and caches it.
    """

    def __init__(
        self,
        configs: dict[str, LLMConfig],
    ) -> None:
        self._configs = configs
        self._registry = LLM_CLIENT_REGISTRY  # the module singleton
        self._instances: dict[str, LLMClientTemplate] = {}

    def get(self, name: str) -> LLMClientTemplate:
        """Return the cached instance, building it on first access."""
        if name not in self._instances:
            if name not in self._configs:
                raise KeyError(
                    f"LLM '{name}' is not configured. "
                    f"Available configs: {sorted(self._configs)}"
                )
            client_cls = self._registry.get(
                name
            )  # may raise LLMClientNotRegisteredError
            LOGGER.info(
                f"Creating the client for {name}  and config  {self._configs[name]}"
            )
            self._instances[name] = client_cls.from_config(self._configs[name])
        return self._instances[name]

    def available(self) -> list[str]:
        """Names that are both configured AND have a registered class."""
        return sorted(set(self._configs) & set(self._registry.names))

    def configured(self) -> list[str]:
        return sorted(self._configs)

    def __contains__(self, name: str) -> bool:
        return name in self._configs
