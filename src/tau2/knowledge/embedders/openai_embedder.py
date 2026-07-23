"""OpenAI embedder using text-embedding models."""

import os
import time
from typing import List

import numpy as np
from openai import APIConnectionError, APIError, OpenAI, RateLimitError

from tau2.knowledge.embedders.base import BaseEmbedder


class OpenAIEmbedder(BaseEmbedder):
    """Embedder using OpenAI's embedding models."""

    def __init__(
        self,
        model: str = "text-embedding-ada-002",
        api_key: str = None,
        batch_size: int = 100,
    ):
        """
        Initialize OpenAI embedder.

        Args:
            model: OpenAI model name. Supported models include:
                   - text-embedding-ada-002 (default, 1536 dimensions)
                   - text-embedding-3-small (1536 dimensions)
                   - text-embedding-3-large (3072 dimensions)
            api_key: OpenAI API key (if None, will use OPENAI_API_KEY env var)
            batch_size: Maximum number of texts sent in one API request.
        """
        if batch_size < 1:
            raise ValueError("batch_size must be at least 1.")

        self.model = "doubao-embedding-large-text-250515"
        self.batch_size = batch_size
        self.client = OpenAI(
            api_key=api_key or os.getenv("OPENAI_API_KEY"),
            max_retries=0,
        )

    def embed(self, texts: List[str], max_retries: int = 5) -> np.ndarray:
        """
        Embed texts using OpenAI API.

        Args:
            texts: List of text strings to embed

        Returns:
            Array of embeddings with shape (len(texts), embedding_dim)
        """
        if not texts:
            raise ValueError("No text to embed.")
        if max_retries < 0:
            raise ValueError("max_retries cannot be negative.")

        embeddings = []
        for start in range(0, len(texts), self.batch_size):
            batch = texts[start : start + self.batch_size]
            for attempt in range(max_retries + 1):
                try:
                    response = self.client.embeddings.create(
                        input=batch,
                        model=self.model,
                    )
                    break
                except (APIError, APIConnectionError, RateLimitError) as error:
                    if attempt == max_retries:
                        raise RuntimeError(
                            "OpenAI-compatible embedding request failed after "
                            f"{max_retries + 1} attempts. Model: {self.model}. "
                            f"Last error: {error}"
                        ) from error
                    time.sleep(2**attempt)

            embeddings.extend(item.embedding for item in response.data)

        return np.array(embeddings)

    def get_name(self) -> str:
        """Return the name of the embedder."""
        return f"openai_{self.model}"
