import asyncio

# uvicorn's built-in "asyncio" loop factory hardcodes asyncio.ProactorEventLoop
# on win32 (see uvicorn/loops/asyncio.py), ignoring any event loop policy set
# beforehand. psycopg's async driver can't run on ProactorEventLoop. Passing
# this factory via `uvicorn.run(..., loop="server.winloop:selector_event_loop_factory")`
# overrides that. Only used for local Windows dev — Render (Linux) doesn't need it.


def selector_event_loop_factory() -> asyncio.AbstractEventLoop:
    return asyncio.SelectorEventLoop()
