"""Skill selection: identify test intent and match dynamic rules.

Called after the reasoning stage. Receives the analysis output and the
dynamic rules catalog, asks the LLM to classify the test and select
matching rules. Returns the list of rule names to activate for hooks
and codegen prompt enrichment.

This is a lightweight, deterministic classification call — not a
creative generation. Uses low temperature and small max_tokens.
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings

if TYPE_CHECKING:
    from .data_models import ResolvedStage

LOGGER = logging.getLogger(__name__)

_SETTINGS = LLMCallSettings(temperature=0.0, max_tokens=256)


_SYSTEM = """\
You are a test classification engine. You receive:
1. An ANALYSIS of a test specification (what the test does).
2. A CATALOG of available domain-specific rules (name + description).

Your job: decide which rules from the catalog are relevant to THIS test.

Rules:
- Select ONLY rules whose description matches the test's actual operations.
- A test can match ZERO rules (generic test) or MULTIPLE rules (e.g. a \
TR-069 test that also does packet capture may match "tr069").
- Return ONLY names that appear in the catalog. Do not invent names.
- When in doubt, do NOT select — the base rules already cover generic tests.

Respond with a JSON object:
{"intent": "<one-line test intent>", "selected_rules": ["name1", "name2"]}

Nothing else. No markdown, no explanation."""


_USER = """\
## ANALYSIS
{analysis}

## AVAILABLE RULES
{catalog}"""


def run_skill_selection(
    stage_config: ResolvedStage,
    analysis: str,
    catalog: str,
) -> list[str]:
    """Select dynamic rules that match the test intent.

    Reuses the reasoning stage's LLM with deterministic settings.
    Returns an empty list if no catalog is available or if the LLM
    selects no rules.

    Args:
        stage_config: The reasoning stage (LLM client reused).
        analysis: Output from the reasoning stage.
        catalog: Formatted catalog from ``domain_setup.dynamic_rules_catalog``.

    Returns:
        List of selected rule names (may be empty).
    """
    if not catalog.strip():
        LOGGER.debug("No dynamic rules catalog — skipping skill selection")
        return []

    system = _SYSTEM
    user = _USER.format(analysis=analysis, catalog=catalog)
    breakpoint()

    response = stage_config.llm.call(system=system, user=user, settings=_SETTINGS)
    breakpoint()

    return _parse_response(response, catalog)


def _parse_response(response: str, catalog: str) -> list[str]:
    """Parse the LLM response and validate against the catalog.

    Extracts ``selected_rules`` from JSON. Filters out any names not
    present in the catalog. Robust to markdown fences and whitespace.
    """
    text = response.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        LOGGER.warning("Skill selector returned non-JSON response: %s", text[:200])
        return []

    selected = parsed.get("selected_rules", [])
    if not isinstance(selected, list):
        LOGGER.warning("selected_rules is not a list: %r", selected)
        return []

    # Validate: only allow names that actually appear in the catalog
    catalog_lower = catalog.lower()
    valid: list[str] = []
    for name in selected:
        if not isinstance(name, str):
            continue
        # Catalog format is "- name: description" per line
        if f"- {name}:" in catalog or f"- {name.lower()}:" in catalog_lower:
            valid.append(name)
        else:
            LOGGER.debug("Skill selector returned unknown rule %r — dropping", name)

    intent = parsed.get("intent", "")
    if intent:
        LOGGER.info("Test intent: %s", intent)
    LOGGER.info("Selected dynamic rules: %s", valid if valid else "(none)")

    return valid
