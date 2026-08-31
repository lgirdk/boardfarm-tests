from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from .data_models import IncludeEntry


@runtime_checkable
class ForceIncludeEntryHook(Protocol):
    """A pipeline callback that guarantees specific indices enter the generation context.

    Called by the pipeline at resolution time - multiple implementations exist,
    each encoding rules for a specific framework or situation. Based on the
    analysis and input, it selects and returns indices that must be included
    in the final LLM call, regardless of what the semantic search found.

    Args:
        analysis: the reasoning output from the previous pipeline stage
        input_text: the raw input specification text
        entry_lookup: registry interface to query entries by name or category

    Returns:
        list[IncludeEntry]
    """

    def __call__(
        self,
        analysis: str,
        input_text: str,
        matched_skills:list[str],
    ) -> list[IncludeEntry]: ...


@runtime_checkable
class PostSearchEnricherHook(Protocol):
    """Inspects selected entries after search and returns additional
    entries that must accompany them - encoding framework-specific
    companion relationships the search cannot infer.

    Returns list[IncludeEntry] to add to the selected set.

    Returns:
        list[IncludeEntry]
    """

    def __call__(
        self,
        analysis: str,
        input_text: str,
        selected_apis: set[str],
        matched_skills:list[str],
    ) -> list[IncludeEntry]: ...
