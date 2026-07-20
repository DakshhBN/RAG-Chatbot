import asyncio
import uuid
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from server.config import settings
from server.database import async_session_maker
from server.embeddings import embed_documents
from server.models.document import Document, DocumentStatus
from server.vectorstore import upsert_chunks


def _process_sync(document_id: uuid.UUID, tmp_path: str) -> int:
    """CPU/IO-bound pipeline (parse -> chunk -> embed -> upsert), run in a worker
    thread via asyncio.to_thread so it doesn't fully block the event loop that's
    also serving other requests. Returns the page count."""
    docs = PyPDFLoader(tmp_path).load()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(docs)
    if not chunks:
        raise ValueError("No extractable text found in this PDF")

    texts = [chunk.page_content for chunk in chunks]
    vectors = embed_documents(texts)

    pinecone_vectors = [
        {
            "id": f"{document_id}_{i}",
            "values": vector,
            "metadata": {
                "chunk_index": i,
                "page_number": chunk.metadata.get("page", 0),
                "text": chunk.page_content,
            },
        }
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    upsert_chunks(namespace=str(document_id), vectors=pinecone_vectors)

    return len(docs)


async def process_document(document_id: uuid.UUID, tmp_path: str) -> None:
    async with async_session_maker() as db:
        document = await db.get(Document, document_id)
        if document is None:
            Path(tmp_path).unlink(missing_ok=True)
            return

        try:
            page_count = await asyncio.to_thread(_process_sync, document_id, tmp_path)
            document.status = DocumentStatus.READY
            document.page_count = page_count
        except Exception as exc:  # noqa: BLE001
            document.status = DocumentStatus.FAILED
            document.error_message = str(exc)[:2000]
        finally:
            Path(tmp_path).unlink(missing_ok=True)

        await db.commit()
