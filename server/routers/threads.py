from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from server.database import get_db
from server.dependencies import get_current_user, get_owned_thread
from server.models.document import Document, DocumentStatus
from server.models.thread import Thread
from server.models.user import User
from server.schemas.thread import MessageOut, ThreadCreate, ThreadOut, ThreadRename

router = APIRouter(prefix="/api/threads", tags=["threads"])


@router.get("", response_model=list[ThreadOut])
async def list_threads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Thread)
        .where(Thread.user_id == current_user.id, Thread.deleted == False)  # noqa: E712
        .order_by(Thread.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ThreadOut, status_code=status.HTTP_201_CREATED)
async def create_thread(
    payload: ThreadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await db.get(Document, payload.document_id)
    if document is None or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document.status != DocumentStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is not ready yet (status: {document.status.value})",
        )

    thread = Thread(
        user_id=current_user.id,
        document_id=document.id,
        title=payload.title or document.original_filename,
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


@router.patch("/{thread_id}", response_model=ThreadOut)
async def rename_thread(
    payload: ThreadRename,
    thread: Thread = Depends(get_owned_thread),
    db: AsyncSession = Depends(get_db),
):
    thread.title = payload.title
    await db.commit()
    await db.refresh(thread)
    return thread


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread: Thread = Depends(get_owned_thread),
    db: AsyncSession = Depends(get_db),
):
    thread.deleted = True
    await db.commit()


@router.get("/{thread_id}/messages", response_model=list[MessageOut])
async def get_thread_messages(
    request: Request,
    thread: Thread = Depends(get_owned_thread),
):
    graph = request.app.state.graph
    config = {"configurable": {"thread_id": str(thread.id)}}
    state = await graph.aget_state(config)
    messages = (state.values or {}).get("messages", [])
    return [
        MessageOut(role="user" if isinstance(m, HumanMessage) else "assistant", content=m.content)
        for m in messages
    ]
