from functools import lru_cache

from fastembed import TextEmbedding

from server.config import settings


@lru_cache(maxsize=1)
def get_embedder() -> TextEmbedding:
    return TextEmbedding(model_name=settings.EMBED_MODEL)


def embed_documents(texts: list[str]) -> list[list[float]]:
    return [vector.tolist() for vector in get_embedder().embed(texts)]


def embed_query(text: str) -> list[float]:
    return next(iter(get_embedder().embed([text]))).tolist()
