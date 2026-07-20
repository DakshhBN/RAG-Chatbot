import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.config import settings

if sys.platform == "win32":
    # psycopg's async driver can't run on Windows' default ProactorEventLoop —
    # only SelectorEventLoop. Not needed on Linux (e.g. Render in production).
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from server.graph.chatbot import build_graph
from server.graph.checkpointer import build_checkpointer, build_checkpointer_pool
from server.routers import auth, chat, documents, threads


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = build_checkpointer_pool()
    await pool.open()
    checkpointer = await build_checkpointer(pool)
    app.state.graph = build_graph(checkpointer)
    app.state.checkpointer_pool = pool
    yield
    await pool.close()


app = FastAPI(title="PdfGini API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(threads.router)
app.include_router(chat.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
