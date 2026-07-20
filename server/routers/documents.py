import io
import tempfile
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.database import get_db
from server.dependencies import get_current_user, get_owned_document
from server.models.document import Document, DocumentStatus
from server.models.user import User
from server.schemas.document import DocumentOut
from server.services.document_processing import process_document
from server.storage import delete_object, upload_bytes
from server.vectorstore import delete_namespace

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported")

    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds the {settings.MAX_UPLOAD_MB}MB limit",
        )

    try:
        page_count = len(PdfReader(io.BytesIO(data)).pages)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read this file as a PDF"
        ) from exc

    if page_count > settings.MAX_UPLOAD_PAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PDF has {page_count} pages, exceeding the {settings.MAX_UPLOAD_PAGES}-page limit",
        )

    document_id = uuid.uuid4()
    storage_key = f"users/{current_user.id}/documents/{document_id}.pdf"

    document = Document(
        id=document_id,
        user_id=current_user.id,
        original_filename=file.filename or "document.pdf",
        storage_key=storage_key,
        status=DocumentStatus.PROCESSING,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    upload_bytes(storage_key, data)

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        tmp.write(data)
    finally:
        tmp.close()

    background_tasks.add_task(process_document, document_id=document.id, tmp_path=tmp.name)

    return document


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.user_id == current_user.id).order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document: Document = Depends(get_owned_document)):
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document: Document = Depends(get_owned_document),
    db: AsyncSession = Depends(get_db),
):
    delete_namespace(str(document.id))
    delete_object(document.storage_key)
    await db.delete(document)
    await db.commit()
