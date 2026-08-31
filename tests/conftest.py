"""Shared fixtures and helpers for the test suite."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure the project root is on sys.path so `from boardfarm_api.ai_engine.xxx import yyy` works
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ----------------------------- Sample IndexEntry data -----------------------------


@pytest.fixture
def sample_class_index_entry() -> dict:
    """A complete TypedDict IndexEntry for a class with methods + properties."""
    return {
        "type": "class",
        "name": "MyDevice",
        "import_": "from my_pkg.devices import MyDevice",
        "file": "my_pkg/devices/my_device.py",
        "signature": "class MyDevice(BaseDevice)",
        "docstring": "Represents a device. With multiple lines.",
        "module": "my_pkg.devices.my_device",
        "hints": ["device", "controller"],
        "bases": ["BaseDevice"],
        "tags": ["hardware"],
        "fields": {"name": "str", "ip": "str"},
        "methods": [
            {
                "name": "reboot",
                "signature": "(self, wait: bool = True) -> None",
                "docstring": "Reboot the device.",
                "tags": ["mutating"],
            },
            {
                "name": "status",
                "signature": "(self) -> str",
                "docstring": "Get status.",
                "tags": [],
            },
        ],
        "properties": [
            {
                "name": "ip_address",
                "return_type": "str",
                "docstring": "Returns the IP.",
                "tags": [],
            },
        ],
    }


@pytest.fixture
def sample_function_index_entry() -> dict:
    """A complete TypedDict IndexEntry for a function."""
    return {
        "type": "function",
        "name": "http_get",
        "import_": "from my_pkg.net import http_get",
        "file": "my_pkg/net/http.py",
        "signature": "(url: str) -> str",
        "docstring": "Perform an HTTP GET.",
        "hints": ["network", "http"],
        "tags": [],
    }


@pytest.fixture
def sample_raw_stub_index(
    sample_class_index_entry, sample_function_index_entry
) -> dict:
    """A complete raw stub index (post-pydantic format with `import` key)."""

    def _to_alias(entry: dict) -> dict:
        e = dict(entry)
        if "import_" in e:
            e["import"] = e.pop("import_")
        return e

    return {
        "use_cases": [_to_alias(sample_function_index_entry)],
        "templates": [_to_alias(sample_class_index_entry)],
        "_meta": [{"ignored": True}],  # underscore-prefixed: should be skipped
    }


@pytest.fixture
def written_stub_index_file(tmp_path: Path, sample_raw_stub_index: dict) -> Path:
    """Write a stub index JSON file to disk and return its path."""
    import json

    p = tmp_path / "stubs_index.json"
    p.write_text(json.dumps(sample_raw_stub_index))
    return p


# ----------------------------- Mock LLM client -----------------------------


@pytest.fixture
def mock_llm_response() -> str:
    """A canned LLM response string."""
    return "Mock analysis response from LLM"


class _StubLLM:
    """Minimal LLM client stub that implements LLMClientTemplate.call(...)."""

    def __init__(self, response: str = "stub-response") -> None:
        self.response = response
        self.calls: list[dict] = []

    def call(self, system: str, user: str, settings=None) -> str:
        self.calls.append({"system": system, "user": user, "settings": settings})
        return self.response

    def get_model_name(self) -> str:
        return "stub-model"


@pytest.fixture
def stub_llm():
    """Returns a callable factory: stub_llm(response='...')."""
    return _StubLLM
