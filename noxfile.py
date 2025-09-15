"""Lint and test boardfarm-tests on multiple python environments."""

import os

import nox

_PYTHON_VERSIONS = ["3.11"]

# Fail nox session when run a program which
# is not installed in its virtualenv
nox.options.error_on_external_run = True

# Reuse existing virtual environments to speedup nox execution locally.
# Jenkins CI pipelines will not reuse it
nox.options.reuse_existing_virtualenvs = os.environ.get("CI", None) != "true"


@nox.session(python=_PYTHON_VERSIONS)
def pylint(session: nox.Session) -> None:
    """Lint boardfarm-tests using pylint without dev dependencies."""
    session.install("-r", "requirements.txt")
    session.install("--upgrade", "pylint==3.2.6")
    session.run("pylint", "tests/")


@nox.session(python=_PYTHON_VERSIONS)
def lint(session: nox.Session) -> None:
    """Lint boardfarm."""
    session.install("-r", "requirements.txt", "-r", "dev-requirements.txt")
    session.run("ruff", "format", "--check", ".")
    session.run("ruff", "check", ".")
    session.run("mypy", "tests")
