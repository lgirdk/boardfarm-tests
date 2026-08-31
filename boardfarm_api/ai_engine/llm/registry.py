import logging
from typing import ClassVar

from .templates import LLMClientTemplate

LOGGER = logging.getLogger(__name__)


class LLMClientAlreadyRegisteredError(Exception):
    """Raised when re-registering a name without explicit override."""


class LLMClientNotRegisteredError(KeyError):
    """Raised when looking up an unregistered client name."""


class RegistrySingleton(type):
    _instance_dict: ClassVar[dict[type, object]] = {}

    def __call__(cls, *args: object, **kwds: object):
        if cls not in cls._instance_dict:
            LOGGER.info(f"Creating singleton class for {cls}")
            cls._instance_dict[cls] = super().__call__(*args, **kwds)
        return cls._instance_dict[cls]


class LLMClientRegistry(metaclass=RegistrySingleton):
    """Catalog of LLM client classes, keyed by name.

    Module owners register their client classes here at import time.
    Consumers look up classes by name when they need to instantiate.
    """

    def __init__(self) -> None:
        self._clients: dict[str, type[LLMClientTemplate]] = {}

    def register(
        self,
        name: str,
        client_cls: type[LLMClientTemplate],
        *,
        override: bool = False,
    ) -> None:
        """Register an LLM client class under a name."""
        if not name or not name.strip():
            raise ValueError("name cannot be empty")
        if not issubclass(client_cls, LLMClientTemplate):
            raise TypeError(f"{client_cls.__name__} must subclass LLMClientTemplate")
        if name in self._clients and not override:
            raise LLMClientAlreadyRegisteredError(
                f"'{name}' is already registered to "
                f"{self._clients[name].__name__}. "
                f"Use override=True to replace, or pick a different name."
            )
        self._clients[name] = client_cls

    def unregister(self, name: str) -> None:
        self._clients.pop(name, None)

    def get(self, name: str) -> type[LLMClientTemplate]:
        if name not in self._clients:
            raise LLMClientNotRegisteredError(
                f"No LLM client registered as '{name}'. "
                f"Available: {sorted(self._clients)}"
            )
        return self._clients[name]

    @property
    def names(self) -> list[str]:
        return sorted(self._clients)

    def __contains__(self, name: str) -> bool:
        return name in self._clients


LLM_CLIENT_REGISTRY = LLMClientRegistry()
