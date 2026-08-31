from __future__ import annotations

import logging
from pathlib import Path

import faiss
import numpy as np

from .data_models import SearchPairs
from .encoders import EncoderModelProtocol
from .utils import checksum_encode_crc32

LOGGER = logging.getLogger(__name__)


class DataIntegrityError(Exception):
    """raised when there is an intigrity error"""


class FaissIndexManager:
    """Manager for Faiss vector store."""

    BATCH_SIZE = 32

    def __init__(
        self,
        *,
        index_name: str,
        index_path: str | Path,
        encoder: EncoderModelProtocol,
    ) -> None:
        if not index_name or not index_name.strip():
            raise ValueError("index_name cannot be empty")

        LOGGER.info(f"...... INITIALIZING FAISS  FOR {index_name}.......")

        index_name = index_name.split(".")[0]
        self.INDEX_VECTOR_FILE_NAME = f"{index_name}.index"
        self.CHECKSUM_FILE = f"{index_name}_CHECKSUM.crc"
        self.index_path: Path = Path(index_path)
        self.index_path.mkdir(parents=True, exist_ok=True)
        self.encoder: EncoderModelProtocol = encoder
        if not isinstance(self.encoder, EncoderModelProtocol):
            raise TypeError(
                f"encoder {type(self.encoder)} does not implement EncoderModelProtocol"
            )

        self.index_vector_store: faiss.Index | None = None

    @property
    def index_exists(self) -> bool:
        return bool(self.index_vector_store)

    def _encode_crc32(self, value: list[str] | str) -> int:
        if isinstance(value, str):
            value = [value]

        return checksum_encode_crc32("\x1f".join(value))

    def verify_search_data_integrity(self, search_pairs: SearchPairs) -> None:
        """Verify SearchPairs checksum matches last build.
        Raises DataIntegrityError if checksum is missing or mismatched.
        """
        try:
            stored = self._load_index_checksum()
        except FileNotFoundError as e:
            raise DataIntegrityError(
                f"Checksum unavailable — index out of sync with SearchPairs. "
                "Run build() first."
                f"ERROR :--- {e}"
            ) from e
        current = self._encode_crc32(search_pairs.keys)
        LOGGER.info(f"VERIFYING CHECKSUM --> CURRENT: {current} , STORED : {stored} ")
        if current != stored:
            raise DataIntegrityError(
                "Checksum mismatch — index out of sync with SearchPairs. "
                "Run build() first."
            )

    def _load_index_checksum(self) -> int:
        checksum_path = self.index_path / self.CHECKSUM_FILE

        if not checksum_path.exists():
            raise FileNotFoundError(
                f"Checksum file not found at {checksum_path}. Run build() first."
            )

        with open(checksum_path) as f:
            stored = int(f.read().strip())
        return stored

    def _write_index_checksum(self, search_pair: SearchPairs) -> None:
        checksum_path = self.index_path / self.CHECKSUM_FILE
        LOGGER.info(f"Writing checksum file path {checksum_path}......")
        with open(checksum_path, "w") as fd:
            crc = self._encode_crc32(search_pair.keys)
            fd.write(str(crc))

    def load_vector_index(self) -> None:
        """Load FAISS index from disk if it exists."""
        index_file = self.index_path / self.INDEX_VECTOR_FILE_NAME
        if not index_file.exists():
            raise FileNotFoundError(
                f"FAISS index not found at {index_file}. Run build() first."
            )
        LOGGER.info(f"*** Loading FAISS index from {index_file}")

        self.index_vector_store = faiss.read_index(str(index_file))

    def build_embeddings_from_stub_idx(self, search_corpus: SearchPairs) -> None:
        """Takes two list"""
        LOGGER.info(
            f"...... CREATING INDEX FOR FASSI filename {self.INDEX_VECTOR_FILE_NAME} ......."
        )
        embed_texts = search_corpus.documents
        if embed_texts:
            # TODO need to strip this out for  OPen AI like api to work as well
            vectors = self.encoder.encode_documents(embed_texts)
            # normalize_embeddings=True does the normalization
            # so no need of  faiss.normalize_L2 separately
            dimension = vectors.shape[1]
            index = faiss.IndexFlatIP(dimension)  # IP = Inner Product
            # When vectors are normalized, Inner Product = Cosine Similarity
            index.add(vectors.astype(np.float32))
            self.index_vector_store = index
            # Save to disk
            LOGGER.info(
                f"** Saving index file to disk name : {self.INDEX_VECTOR_FILE_NAME}"
            )
            faiss.write_index(
                self.index_vector_store,
                str(self.index_path / self.INDEX_VECTOR_FILE_NAME),
            )
            self._write_index_checksum(search_pair=search_corpus)

    def load_or_build(self, search_pairs: SearchPairs) -> None:
        """Load from disk if available, otherwise build fresh."""
        try:
            self.load_vector_index()
            self.verify_search_data_integrity(search_pairs)
            LOGGER.info("**** FAISS index loaded from disk. *****")
        except (FileNotFoundError, DataIntegrityError):
            LOGGER.info("FAISS index not found or out of sync -->> Rebuilding.....")
            self.build_embeddings_from_stub_idx(search_pairs)

    def search(
        self, text_list: list[str], top_k: int = 3, threshold_percent: int = 75
    ) -> list[tuple[str, list[int]]]:
        if threshold_percent > 100:
            raise Exception("Threshold cannot be more than 100 percent")
        if self.index_vector_store is None:
            raise Exception("The faiss vector index has not been loaded.")

        query_vector = self.encoder.encode_queries(text_list)
        # search — get more than needed if filtering by category
        # fetch_k = top_k * 4 if category else top_k
        threshold = threshold_percent / 100
        doc_to_search_hits: list[tuple[str, list[int]]] = []

        distances, indices = self.index_vector_store.search(query_vector, k=top_k)
        curr_idx = -1
        for d, k in zip(distances, indices, strict=True):
            curr_idx += 1
            curr_doc = text_list[curr_idx]
            hits = []
            for d_value, k_value in zip(d, k, strict=True):
                if d_value > threshold:
                    hits.append(int(k_value))
            doc_to_search_hits.append((curr_doc, hits))

        return doc_to_search_hits
