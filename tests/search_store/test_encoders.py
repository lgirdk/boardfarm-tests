"""Tests for src/search_store/encoders.py (with mocked external models)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np

from boardfarm_api.ai_engine.search_store.encoders import (
    BasicCrossEncoderReranker,
    CrossEncoderModelProtocol,
    EncoderModelProtocol,
    OpenAIEncoder,
    SentenceTransformerEncoder,
)


def _fake_array(shape):
    return np.zeros(shape, dtype=np.float32)


class TestSentenceTransformerEncoder:
    def test_encode_documents_no_prefix(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.SentenceTransformer") as MockST:
            instance = MockST.return_value
            instance.encode.return_value = _fake_array((3, 4))

            enc = SentenceTransformerEncoder("path/to/model")
            out = enc.encode_documents(["a", "b", "c"])
            assert out.shape == (3, 4)
            instance.encode.assert_called_once()
            # Should be called with the original list (no prefix)
            assert instance.encode.call_args.args[0] == ["a", "b", "c"]

    def test_encode_documents_with_passage_prefix(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.SentenceTransformer") as MockST:
            instance = MockST.return_value
            instance.encode.return_value = _fake_array((2, 4))

            enc = SentenceTransformerEncoder("path", passage_prefix="passage: ")
            enc.encode_documents(["a", "b"])
            assert instance.encode.call_args.args[0] == ["passage: a", "passage: b"]

    def test_encode_queries_with_query_prefix(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.SentenceTransformer") as MockST:
            instance = MockST.return_value
            instance.encode.return_value = _fake_array((2, 4))

            enc = SentenceTransformerEncoder("path", query_prefix="query: ")
            enc.encode_queries(["q1", "q2"])
            assert instance.encode.call_args.args[0] == ["query: q1", "query: q2"]

    def test_model_interface(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.SentenceTransformer") as MockST:
            instance = MockST.return_value
            enc = SentenceTransformerEncoder("path")
            assert enc.model_interface is instance

    def test_implements_encoder_protocol(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.SentenceTransformer"):
            enc = SentenceTransformerEncoder("path")
            assert isinstance(enc, EncoderModelProtocol)


class TestOpenAIEncoder:
    def test_encode_returns_numpy_array(self):
        with patch("openai.OpenAI") as MockClient:
            instance = MockClient.return_value
            resp = MagicMock()
            d1 = MagicMock()
            d1.embedding = [0.1, 0.2, 0.3]
            d2 = MagicMock()
            d2.embedding = [0.4, 0.5, 0.6]
            resp.data = [d1, d2]
            instance.embeddings.create.return_value = resp

            enc = OpenAIEncoder(model="text-embedding-3-small")
            out = enc.encode(["a", "b"])
            assert out.shape == (2, 3)
            assert out.dtype == np.float32

    def test_encode_documents_delegates(self):
        with patch("openai.OpenAI") as MockClient:
            instance = MockClient.return_value
            instance.embeddings.create.return_value = MagicMock(data=[])
            enc = OpenAIEncoder()
            enc.encode_documents(["x"])
            instance.embeddings.create.assert_called_once()

    def test_encode_queries_delegates(self):
        with patch("openai.OpenAI") as MockClient:
            instance = MockClient.return_value
            instance.embeddings.create.return_value = MagicMock(data=[])
            enc = OpenAIEncoder()
            enc.encode_queries(["x"])
            instance.embeddings.create.assert_called_once()


class TestBasicCrossEncoderReranker:
    def test_predict_passes_args(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.CrossEncoder") as MockCE:
            instance = MockCE.return_value
            instance.predict.return_value = _fake_array((3,))

            r = BasicCrossEncoderReranker(model_path="some/path", batch_size=8)
            scores = r.predict([("q", "d1"), ("q", "d2"), ("q", "d3")])
            assert scores.shape == (3,)
            kwargs = instance.predict.call_args.kwargs
            assert kwargs["batch_size"] == 8
            assert kwargs["convert_to_numpy"] is True

    def test_implements_cross_encoder_protocol(self):
        with patch("boardfarm_api.ai_engine.search_store.encoders.CrossEncoder"):
            r = BasicCrossEncoderReranker(model_path="x")
            assert isinstance(r, CrossEncoderModelProtocol)
