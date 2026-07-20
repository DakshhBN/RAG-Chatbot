from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from server.config import settings

CONNECTION_KWARGS = {"autocommit": True, "prepare_threshold": 0}


def build_checkpointer_pool() -> AsyncConnectionPool:
    return AsyncConnectionPool(
        conninfo=settings.CHECKPOINTER_DATABASE_URL,
        max_size=20,
        kwargs=CONNECTION_KWARGS,
        open=False,
        # Neon (serverless Postgres) can silently terminate idle connections.
        # Without a liveness check, the pool hands out a dead connection and
        # the query fails with psycopg.errors.AdminShutdown. This validates
        # (and transparently replaces) a connection before it's handed out —
        # the same role pool_pre_ping plays for the SQLAlchemy engine in
        # database.py.
        check=AsyncConnectionPool.check_connection,
    )


async def build_checkpointer(pool: AsyncConnectionPool) -> AsyncPostgresSaver:
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    return checkpointer
