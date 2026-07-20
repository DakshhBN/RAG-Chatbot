from functools import lru_cache

from pinecone import Pinecone, ServerlessSpec

from server.config import settings


@lru_cache(maxsize=1)
def get_pinecone_client() -> Pinecone:
    return Pinecone(api_key=settings.PINECONE_API_KEY)


def get_index():
    return get_pinecone_client().Index(settings.PINECONE_INDEX_NAME)


def ensure_index_exists() -> None:
    """One-time setup — safe to call repeatedly, no-ops if the index already exists."""
    pc = get_pinecone_client()
    existing = {idx["name"] for idx in pc.list_indexes()}
    if settings.PINECONE_INDEX_NAME not in existing:
        pc.create_index(
            name=settings.PINECONE_INDEX_NAME,
            dimension=settings.EMBED_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )


def upsert_chunks(namespace: str, vectors: list[dict]) -> None:
    get_index().upsert(vectors=vectors, namespace=namespace)


def query_namespace(namespace: str, vector: list[float], top_k: int) -> list[dict]:
    result = get_index().query(namespace=namespace, vector=vector, top_k=top_k, include_metadata=True)
    return [{"id": m["id"], "score": m["score"], "metadata": m.get("metadata") or {}} for m in result["matches"]]


def delete_namespace(namespace: str) -> None:
    try:
        get_index().delete(namespace=namespace, delete_all=True)
    except Exception:
        # Pinecone errors if the namespace doesn't exist (e.g. the document had 0
        # chunks, or upload failed before any upsert happened) — safe to ignore.
        pass
