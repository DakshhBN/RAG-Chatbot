"""Local dev entrypoint. Run with: python run_dev.py

uvicorn's built-in "asyncio" loop factory hardcodes asyncio.ProactorEventLoop
on win32 regardless of any event loop policy set beforehand (see
uvicorn/loops/asyncio.py). psycopg's async driver can't run on that loop, only
SelectorEventLoop. Passing a custom loop factory via `loop=` is the only way
to override this. Not needed on Linux (e.g. Render in production) — there
uvicorn's default is already SelectorEventLoop-based.
"""
import sys

import uvicorn

if __name__ == "__main__":
    loop = "server.winloop:selector_event_loop_factory" if sys.platform == "win32" else "auto"
    uvicorn.run("server.main:app", host="127.0.0.1", port=8001, reload=False, loop=loop)
