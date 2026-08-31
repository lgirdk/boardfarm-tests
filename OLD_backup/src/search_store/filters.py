from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from .custome_types import CorpusHits


@runtime_checkable
class CorpusHitsFilterProtocol(Protocol):
    def __call__(self, hits: CorpusHits) -> CorpusHits: ...

    # @classmethod
    # def from_config(cls,*a:Any)->Self:
    #     ...


# class FileDeduplicationFilter:
#     def __call__(self, hits: CorpusHits) -> CorpusHits: ...

#     # @classmethod
#     # def from_config(cls,*a:Any)->Self:
#     #     ...


class RepoPriorityFilter:
    """Only filter cross repo similar names if priority list provided.
    ..:: NOTE  it follows the protocol CorpusHitsFilterProtocol
    """

    def __init__(self, priority_list: list[str]):
        self.priority_list = priority_list

    def __call__(self, hits: CorpusHits) -> CorpusHits:
        name_to_repo_map: dict[str, dict[str, list[int]]] = {}
        index_to_keep = []
        filtered_corpus: CorpusHits = {}
        for hit_idx, hit_value in hits.items():
            name_to_repo_map.setdefault(hit_value["root_name"], {}).setdefault(
                hit_value["repo_name"], []
            ).append(hit_idx)

        for _, repo_entries in name_to_repo_map.items():
            for priority_repo_name in self.priority_list:
                if priority_repo_name in repo_entries:
                    index_to_keep.extend(repo_entries[priority_repo_name])
                    break
            else:
                for val_idx in repo_entries.values():
                    index_to_keep.extend(val_idx)
        for idx in index_to_keep:
            filtered_corpus[idx] = hits[idx]
        return filtered_corpus

    # We can use constructinos pattern   for latter  ......
    # @classmethod
    # def from_config(cls,*a:Any)->Self:
    #     ...


class RepoExcludeFilter:
    """Exclude all entries from specified repos completely.
    ..:: NOTE it follows the protocol CorpusHitsFilterProtocol
    """

    def __init__(self, exclude_repos: list[str]):
        self.exclude_repos = set(exclude_repos)  # set for O(1) lookup

    def __call__(self, hits: CorpusHits) -> CorpusHits:
        return {
            idx: hit_value
            for idx, hit_value in hits.items()
            if hit_value["repo_name"] not in self.exclude_repos
        }
