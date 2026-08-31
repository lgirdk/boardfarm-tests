from typing import Protocol, runtime_checkable

import numpy as np
from numpy.typing import NDArray
from sentence_transformers import CrossEncoder, SentenceTransformer


class ProtocolError(Exception):
    """Raised when protocol is not followed"""


@runtime_checkable
class EncoderModelProtocol(Protocol):
    """Base encoder model."""

    def encode_documents(self, texts: list[str]) -> NDArray[np.float32]:
        """Encode passages/documents at indexing time."""

    def encode_queries(self, texts: list[str]) -> NDArray[np.float32]:
        """Encode queries at search/inference time."""


@runtime_checkable
class CrossEncoderModelProtocol(Protocol):
    """Base Cross encoder model."""

    def predict(
        self,
        pairs: list[tuple[str, str]],
        show_progress_bar: bool = True,
    ) -> NDArray[np.float32]:
        """Score query-document pairs. Returns one float per pair."""
        ...


class SentenceTransformerEncoder:
    """Wraps sentence-transformers to match EncoderModelProtocol."""

    def __init__(
        self,
        model_path: str,
        local_files_only: bool = False,
        batch_size: int = 32,
        query_prefix: str = "",
        passage_prefix: str = "",
    ) -> None:
        # The polling for the tokens is alrady taken care by the models config during download
        # No mnaual override is needed.
        self._model: SentenceTransformer = SentenceTransformer(
            model_path, local_files_only=local_files_only
        )
        self._batch_size = batch_size
        self.query_prefix = query_prefix
        self.passage_prefix = passage_prefix

    @property
    def model_interface(self) -> SentenceTransformer:
        return self._model

    def encode_documents(self, texts: list[str]) -> NDArray[np.float32]:
        """Encode passages/documents at indexing time."""
        text_list = (
            [f"{self.passage_prefix}{text}" for text in texts]
            if self.passage_prefix
            else texts
        )
        return self._encode(text_list)

    def encode_queries(self, texts: list[str]) -> NDArray[np.float32]:
        """Encode queries at search/inference time."""
        text_list = (
            [f"{self.query_prefix}{text}" for text in texts]
            if self.query_prefix
            else texts
        )
        return self._encode(text_list)

    def _encode(self, text_list: list[str]) -> NDArray[np.float32]:
        return self._model.encode(
            text_list,
            convert_to_numpy=True,
            normalize_embeddings=True,  # normlize the vectors , throw the magnitude keep the direction.
            precision="float32",
            batch_size=self._batch_size,
        )


class OpenAIEncoder:
    """Wraps OpenAI embeddings to match EncoderModelProtocol."""

    def __init__(
        self, model: str = "text-embedding-3-small", api_key_env: str | None = None
    ):
        try:
            from openai import OpenAI

            self._client = OpenAI(api_key=api_key_env)
            self._model = model
        except ImportError as err:
            raise ImportError("openAI sdk not installed") from err

    def encode(self, embed_texts: list[str]) -> NDArray[np.float32]:
        response = self._client.embeddings.create(input=embed_texts, model=self._model)
        return np.array([item.embedding for item in response.data], dtype=np.float32)

    def encode_documents(self, texts: list[str]) -> NDArray[np.float32]:
        """Encode passages/documents at indexing time."""
        return self.encode(texts)

    def encode_queries(self, texts: list[str]) -> NDArray[np.float32]:
        """Encode queries at search/inference time."""
        return self.encode(texts)


class BasicCrossEncoderReranker:
    """Wraps sentence-transformers CrossEncoder to match RerankerProtocol."""

    def __init__(
        self,
        model_path: str = "BAAI/bge-reranker-base",
        local_files_only: bool = False,
        batch_size: int = 32,
        max_length: int | None = None,  # max tokens per pair
    ):
        self._model = CrossEncoder(
            model_path,
            max_length=max_length,  # truncates pairs exceeding this
            local_files_only=local_files_only,
        )
        self._batch_size = batch_size

    def predict(
        self,
        pairs: list[tuple[str, str]],
        show_progress_bar: bool = True,
    ) -> NDArray[np.float32]:
        """Score query-document pairs. Returns one float per pair."""
        return self._model.predict(  # type: ignore[no-any-return]
            pairs,
            batch_size=self._batch_size,
            convert_to_numpy=True,  # return np array, not list
            show_progress_bar=show_progress_bar,
        )
        # returns shape (n_pairs,) — one score per pair
        # e.g. array([3.84, -1.2, 7.1, 0.03, ...])
