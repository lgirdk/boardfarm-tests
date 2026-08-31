#!/usr/bin/env python3
"""
PYI Stub Generator for Network Test Automation Framework
=========================================================

This script scans your framework's Python source files and generates
.pyi stub files containing ONLY:
  - Class definitions with method signatures
  - Function signatures with type hints
  - Docstrings (preserved — these are critical for Claude)
  - Constants and module-level variables
  - Dataclass / NamedTuple definitions

It strips out ALL implementation details so you can safely expose
the stubs to Claude Code without revealing proprietary logic.

Usage:
    python generate_stubs.py --source framework/internals --output framework/stubs
    python generate_stubs.py --source framework/ --output framework/stubs --exclude internals/ssh_handler.py
    python generate_stubs.py --source framework/internals --output framework/stubs --dry-run

Requirements:
    Python 3.8+ (uses ast module, no external dependencies)
"""

import ast
import tomllib
from dataclasses import dataclass
from pathlib import Path

from rich import print

SOURCE = '''
"""Module docstring for the test module."""

import os
import sys
from typing import TYPE_CHECKING, Optional, List
from dataclasses import dataclass

if TYPE_CHECKING:
    from pathlib import Path
    from collections import OrderedDict

__version__ = "1.0.0"
__all__ = ["Server", "helper"]

MAX_RETRIES: int = 3
DEFAULT_HOST: str = "localhost"

if sys.platform == "win32":
    PLATFORM_PATH = "C:\\\\app"
else:
    PLATFORM_PATH = "/usr/local/app"


@dataclass
class Config:
    """Configuration for the server."""
    host: str = "localhost"
    port: int = 8080
    debug: bool = False

    def validate(self) -> bool:
        """Check if config is valid."""
        if self.port < 0:
            raise ValueError("bad port")
        return True

    class SSLConfig:
        """Nested SSL configuration."""
        cert_path: Optional[str] = None
        key_path: Optional[str] = None

        def load_cert(self, path: "Path") -> bytes:
            """Load certificate from disk."""
            with open(path, "rb") as f:
                data = f.read()
            return data

        class CipherSuite:
            """Double-nested class."""
            name: str
            strength: int

            def is_secure(self) -> bool:
                """Check cipher strength."""
                return self.strength >= 128


class Server:
    """Main server class.

    Handles connections and request routing.
    """
    host: str
    port: int
    _connections: List[str] = []

    def __init__(self, config: Config, name: str = "default") -> None:
        """Initialize the server."""
        self.config = config
        self.name = name
        self._setup_logging()

    def _setup_logging(self) -> None:
        """Private setup method — should still appear in stub."""
        import logging
        self.logger = logging.getLogger(self.name)

    @staticmethod
    def create_default() -> "Server":
        """Factory method."""
        cfg = Config()
        return Server(cfg)

    @classmethod
    def from_dict(cls, data: dict) -> "Server":
        """Create server from dictionary config."""
        cfg = Config(**data)
        return cls(cfg)

    async def start(self, *, blocking: bool = True) -> None:
        """Start the server."""

        async def _heartbeat():
            while True:
                await asyncio.sleep(1)

        def _cleanup():
            for conn in self._connections:
                conn.close()

        self.running = True
        if blocking:
            await _heartbeat()

    async def handle_request(
        self,
        method: str,
        path: str,
        headers: Optional[dict] = None,
        body: Optional[bytes] = None,
    ) -> dict:
        """Handle an incoming HTTP request.

        Args:
            method: HTTP method
            path: Request path
            headers: Optional headers dict
            body: Optional request body
        """
        if method == "GET":
            result = await self._do_get(path)
        elif method == "POST":
            result = await self._do_post(path, body)
        else:
            result = {"error": "unsupported method"}
        return result

    def __repr__(self) -> str:
        return f"Server({self.name!r}, {self.config.host}:{self.config.port})"

    def __enter__(self) -> "Server":
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.stop()


def helper(items: List[str], *, reverse: bool = False) -> Optional[str]:
    """A module-level helper function."""

    def _sort(lst):
        return sorted(lst, reverse=reverse)

    sorted_items = _sort(items)
    if sorted_items:
        return sorted_items[0]
    return None


async def fetch_data(
    url: str,
    timeout: float = 30.0,
    retries: int = MAX_RETRIES,
) -> bytes:
    """Fetch data from a URL with retry logic."""
    for attempt in range(retries):
        try:
            response = await client.get(url, timeout=timeout)
            return response.content
        except Exception as e:
            if attempt == retries - 1:
                raise
    return b""


T = List[Optional[str]]
'''


@dataclass
class RepoSettings:
    include_dirs: list[str]
    exclude_dirs: list[str]
    exclude_files: list[str]


@dataclass
class OutputSettings:
    stub_dir: str
    overwrite: bool


@dataclass
class GlobalFilterSettings:
    exclude_dirs: list[str]
    exclude_files: list[str]


class Config:
    def __init__(self, settings_file: Path):
        with open(settings_file, "rb") as fd:
            config = tomllib.load(fd)

        self.output = OutputSettings(**config["output"])
        self.filters = GlobalFilterSettings(**config["filters"])
        self.repo_settings: dict[str, RepoSettings] = {}
        for repo_name in config["repositories"]["names"]:
            overrides: dict = config["repositories"].get(repo_name, {})
            self.repo_settings.update(
                {
                    repo_name: RepoSettings(
                        include_dirs=overrides.get("include_only", []),
                        exclude_dirs=overrides.get("exclude_dirs", []),
                        exclude_files=overrides.get("exclude_files", []),
                    )
                }
            )


class TransforNode(ast.NodeTransformer):
    def _strip_func_body(self, node: ast.FunctionDef | ast.AsyncFunctionDef):
        docstring = ast.get_docstring(node)
        new_body = []
        if docstring:
            new_body.append(node.body[0])  # the Expr(Constant("doc"))
        new_body.append(ast.Expr(value=ast.Constant(value=...)))
        node.body = new_body

        return node

    def visit_If(self, node):

        if isinstance(node.test, ast.Name) and node.test.id == "TYPE_CHECKING":
            self.generic_visit(node)
            return node
        return

    def visit_AsyncFunctionDef(self, node):

        return self._strip_func_body(node)

    def visit_FunctionDef(self, node):
        return self._strip_func_body(node)

    def visit_Try(self, node):
        """Remove try/except blocks — these are implementation."""
        return None

    def visit_With(self, node):
        """Remove with-statements — these are implementation."""
        return None

    def visit_While(self, node):
        """Remove while loops."""
        return None

    def visit_For(self, node):
        """Remove for loops."""
        return None

    def visit_Assert(self, node):
        """Remove assertions."""
        return None


def process_source_code(source_code: str) -> str:

    tree = ast.parse(source_code)

    transformed_tree = TransforNode().visit(tree)
    transformed_code = ast.unparse(transformed_tree)
    return transformed_code


def create_repo_stub(repo_name: str, repo_path: Path, conf: Config):

    conf.output.stub_dir
    repo_setting = conf.repo_settings[repo_name]
    exclude_files = conf.filters.exclude_files + repo_setting.exclude_files
    exclude_dirs = conf.filters.exclude_dirs + repo_setting.exclude_dirs
    include_dirs = repo_setting.include_dirs
    parent_path = repo_path.parent
    files_list: list[Path] = []
    for path, dirs, files in repo_path.walk():
        filtered_dirs = []
        for directory in dirs:
            if directory in exclude_dirs:
                continue
            # if include_dirs and directory in include_dirs:

            filtered_dirs.append(directory)

        dirs[:] = filtered_dirs

        for file_name in files:
            file_path = path / file_name

            if file_name.endswith(".py") and not any(
                file_path.match(pat) for pat in exclude_files
            ):
                files_list.append(file_path)

    for file in files_list:
        source_code = file.read_text(encoding="utf-8")
        stub_code = process_source_code(source_code)

        output_file_path = (
            parent_path / conf.output.stub_dir / file.relative_to(parent_path)
        )
        output_file_path.parent.mkdir(parents=True, exist_ok=True)
        output_file_path = output_file_path.with_suffix(".pyi")
        output_file_path.write_text(stub_code, encoding="utf-8")


def main():

    conf = Config(Path("/home/ahazra/workspace/boardfarm3/stub_settings.toml"))

    parent_path = Path(__file__).parent

    all_repo_path = {}
    for repo_name in conf.repo_settings.keys():
        re = parent_path / repo_name
        if not re.exists() and re.is_dir():
            raise ValueError(
                f"the provided repo is not present {repo_name} in the path {str(re)} or its not a diretory"
            )
        all_repo_path[repo_name] = re

    for repo_name, repo_path in all_repo_path.items():
        create_repo_stub(repo_name, repo_path, conf)


if __name__ == "__main__":
    main()
