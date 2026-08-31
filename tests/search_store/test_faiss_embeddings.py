"""Tests for src/search_store/faiss_embeddings.py.

We mock the faiss library entirely to avoid dependencies on the actual index.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from boardfarm_api.ai_engine.search_store.data_models import SearchPairs
from boardfarm_api.ai_engine.search_store.faiss_embeddings import (
    DataIntegrityError,
    FaissIndexManager,
)


def _fake_encoder(dim: int = 4):
    enc = MagicMock()
    enc.encode_documents.return_value = np.zeros((2, dim), dtype=np.float32)
    enc.encode_queries.return_value = np.zeros((1, dim), dtype=np.float32)
    # For runtime_checkable Protocol
    enc.__class__ = type(
        "FakeEnc",
        (),
        {
            "encode_documents": enc.encode_documents,
            "encode_queries": enc.encode_queries,
        },
    )
    return enc


class _RealishEncoder:
    """Implements EncoderModelProtocol structurally."""

    def __init__(self, dim: int = 4):
        self.dim = dim

    def encode_documents(self, texts):
        return np.ones((len(texts), self.dim), dtype=np.float32)

    def encode_queries(self, texts):
        return np.ones((len(texts), self.dim), dtype=np.float32)


class TestFaissIndexManagerInit:
    def test_empty_index_name_rejected(self, tmp_path):
        with pytest.raises(ValueError, match="empty"):
            FaissIndexManager(
                index_name="",
                index_path=tmp_path,
                encoder=_RealishEncoder(),
            )

    def test_whitespace_index_name_rejected(self, tmp_path):
        with pytest.raises(ValueError):
            FaissIndexManager(
                index_name="   ",
                index_path=tmp_path,
                encoder=_RealishEncoder(),
            )

    def test_invalid_encoder_rejected(self, tmp_path):
        with pytest.raises(TypeError, match="EncoderModelProtocol"):
            FaissIndexManager(
                index_name="x",
                index_path=tmp_path,
                encoder="not an encoder",  # type: ignore[arg-type]
            )

    def test_strips_extension_from_index_name(self, tmp_path):
        m = FaissIndexManager(
            index_name="my_index.index",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        assert m.INDEX_VECTOR_FILE_NAME == "my_index.index"
        assert m.CHECKSUM_FILE == "my_index_CHECKSUM.crc"

    def test_creates_index_path(self, tmp_path):
        target = tmp_path / "nested" / "path"
        FaissIndexManager(
            index_name="x",
            index_path=target,
            encoder=_RealishEncoder(),
        )
        assert target.exists()

    def test_index_exists_false_initially(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        assert m.index_exists is False


class TestChecksumIO:
    def test_write_and_read_checksum_roundtrip(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        pairs = SearchPairs(documents=["d1"], keys=["k1"])
        m._write_index_checksum(pairs)
        stored = m._load_index_checksum()
        assert stored == m._encode_crc32(pairs.keys)

    def test_load_checksum_missing_raises(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        with pytest.raises(FileNotFoundError):
            m._load_index_checksum()

    def test_verify_integrity_no_checksum(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        pairs = SearchPairs(documents=[], keys=["k1"])
        with pytest.raises(DataIntegrityError):
            m.verify_search_data_integrity(pairs)

    def test_verify_integrity_mismatch(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        m._write_index_checksum(SearchPairs(documents=[], keys=["k1"]))
        with pytest.raises(DataIntegrityError, match="mismatch"):
            m.verify_search_data_integrity(
                SearchPairs(documents=[], keys=["different"])
            )

    def test_verify_integrity_match(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        pairs = SearchPairs(documents=[], keys=["k1", "k2"])
        m._write_index_checksum(pairs)
        m.verify_search_data_integrity(pairs)  # no raise


class TestBuildEmbeddings:
    def test_build_writes_index_and_checksum(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(dim=4),
        )
        pairs = SearchPairs(documents=["d1", "d2"], keys=["k1", "k2"])
        with patch("boardfarm_api.ai_engine.search_store.faiss_embeddings.faiss") as mock_faiss:
            mock_index = MagicMock()
            mock_faiss.IndexFlatIP.return_value = mock_index
            m.build_embeddings_from_stub_idx(pairs)
            mock_faiss.IndexFlatIP.assert_called_once_with(4)
            mock_index.add.assert_called_once()
            mock_faiss.write_index.assert_called_once()
        assert (tmp_path / m.CHECKSUM_FILE).exists()

    def test_build_with_empty_documents_does_nothing(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        pairs = SearchPairs(documents=[], keys=[])
        with patch("boardfarm_api.ai_engine.search_store.faiss_embeddings.faiss") as mock_faiss:
            m.build_embeddings_from_stub_idx(pairs)
            mock_faiss.write_index.assert_not_called()


class TestLoadVectorIndex:
    def test_raises_when_missing(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        with pytest.raises(FileNotFoundError, match="FAISS index not found"):
            m.load_vector_index()

    def test_loads_existing(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        # Touch the index file
        index_file = tmp_path / m.INDEX_VECTOR_FILE_NAME
        index_file.write_bytes(b"dummy")
        with patch("boardfarm_api.ai_engine.search_store.faiss_embeddings.faiss") as mock_faiss:
            mock_faiss.read_index.return_value = "fake_index"
            m.load_vector_index()
            assert m.index_vector_store == "fake_index"
            mock_faiss.read_index.assert_called_once_with(str(index_file))


class TestSearch:
    def test_raises_when_not_loaded(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        with pytest.raises(Exception, match="not been loaded"):
            m.search(["q"])

    def test_raises_when_threshold_too_high(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        with pytest.raises(Exception, match="more than 100"):
            m.search(["q"], threshold_percent=150)

    def test_returns_hits_above_threshold(self, tmp_path):
        m = FaissIndexManager(
            index_name="x",
            index_path=tmp_path,
            encoder=_RealishEncoder(),
        )
        # Set up a fake vector store
        fake_store = MagicMock()
        # Distances and indices for 1 query, top_k=3
        # threshold_percent=50 → threshold=0.5
        fake_store.search.return_value = (
            np.array([[0.9, 0.4, 0.7]]),  # only 0.9 and 0.7 pass 0.5 threshold
            np.array([[0, 1, 2]]),
        )
        m.index_vector_store = fake_store

        out = m.search(["test query"], top_k=3, threshold_percent=50)
        assert len(out) == 1
        doc, hits = out[0]
        assert doc == "test query"
        assert hits == [0, 2]
