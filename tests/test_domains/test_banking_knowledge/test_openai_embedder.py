from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import numpy as np
import pytest
from openai import RateLimitError

from tau2.knowledge.embedders.openai_embedder import OpenAIEmbedder


def test_embed_batches_requests_and_preserves_order():
    embedder = OpenAIEmbedder.__new__(OpenAIEmbedder)
    embedder.model = "test-model"
    embedder.batch_size = 2
    embedder.client = MagicMock()
    embedder.client.embeddings.create.side_effect = [
        SimpleNamespace(
            data=[
                SimpleNamespace(embedding=[1.0, 10.0]),
                SimpleNamespace(embedding=[2.0, 20.0]),
            ]
        ),
        SimpleNamespace(data=[SimpleNamespace(embedding=[3.0, 30.0])]),
    ]

    result = embedder.embed(["one", "two", "three"])

    assert embedder.client.embeddings.create.call_count == 2
    embedder.client.embeddings.create.assert_any_call(
        input=["one", "two"], model="test-model"
    )
    embedder.client.embeddings.create.assert_any_call(
        input=["three"], model="test-model"
    )
    np.testing.assert_array_equal(
        result,
        np.array([[1.0, 10.0], [2.0, 20.0], [3.0, 30.0]]),
    )


def test_embed_rejects_empty_input_without_api_call():
    embedder = OpenAIEmbedder.__new__(OpenAIEmbedder)
    embedder.client = MagicMock()

    with pytest.raises(ValueError, match="No text to embed"):
        embedder.embed([])

    embedder.client.embeddings.create.assert_not_called()


def test_embed_retries_rate_limit_errors():
    embedder = OpenAIEmbedder.__new__(OpenAIEmbedder)
    embedder.model = "test-model"
    embedder.batch_size = 100
    embedder.client = MagicMock()
    request = httpx.Request("POST", "https://example.test/embeddings")
    response = httpx.Response(429, request=request)
    embedder.client.embeddings.create.side_effect = [
        RateLimitError("server overloaded", response=response, body=None),
        SimpleNamespace(data=[SimpleNamespace(embedding=[1.0, 2.0])]),
    ]

    with patch("tau2.knowledge.embedders.openai_embedder.time.sleep") as sleep:
        result = embedder.embed(["one"])

    sleep.assert_called_once_with(1)
    np.testing.assert_array_equal(result, np.array([[1.0, 2.0]]))


def test_init_rejects_invalid_batch_size():
    with pytest.raises(ValueError, match="batch_size must be at least 1"):
        OpenAIEmbedder(batch_size=0)
