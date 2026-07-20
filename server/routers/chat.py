from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from starlette.requests import Request

from server.dependencies import get_owned_thread
from server.models.thread import Thread
from server.schemas.thread import ChatRequest
from server.sse import sse_event

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/{thread_id}/stream")
async def stream_chat(
    request: Request,
    payload: ChatRequest,
    thread: Thread = Depends(get_owned_thread),
):
    if thread.document_id is None:
        async def _no_document() -> AsyncGenerator[str, None]:
            yield sse_event({"error": "This thread's document is no longer available."}, event="error")
            yield sse_event({}, event="done")

        return StreamingResponse(_no_document(), media_type="text/event-stream")

    graph = request.app.state.graph
    config = {
        "configurable": {
            "thread_id": str(thread.id),
            "document_id": str(thread.document_id),
        }
    }

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async for chunk, metadata in graph.astream(
                {"messages": [HumanMessage(content=payload.content)]},
                config=config,
                stream_mode="messages",
            ):
                if metadata.get("langgraph_node") != "chat_node":
                    continue
                content = getattr(chunk, "content", None)
                if content:
                    yield sse_event({"content": content})
        except Exception as exc:  # noqa: BLE001
            yield sse_event({"error": str(exc)}, event="error")
        yield sse_event({}, event="done")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
