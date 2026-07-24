# PdfGini

A retrieval-augmented PDF chatbot. Upload a PDF and chat with it — every answer is grounded strictly in that document's content, with no outside knowledge and no cross-document leakage between chats.

**Live app:** https://rag-chatbot-frontend-rmxz.onrender.com

## What it does

- Upload a PDF (≤ 10 MB, ≤ 150 pages) and it's parsed, chunked, embedded, and indexed in the background.
- Start a chat bound to that document; questions are answered only from its content — the model says "I don't know" rather than guessing.
- Full multi-turn conversation memory per thread.
- Rename/delete threads, delete documents (cascades to their vector index and stored file).
- Email/password auth, multi-tenant isolation between users.

## Tech stack

**Backend** — FastAPI, SQLAlchemy 2.0 (async), Alembic, PyJWT + bcrypt, LangGraph (retrieval → chat pipeline), Groq (`llama-3.3-70b-versatile`), Pinecone (vector search, one namespace per document), fastembed (`BAAI/bge-small-en-v1.5`), Backblaze B2 (PDF storage), PostgreSQL on Neon.

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router v7, Axios, SSE streaming, `motion`.

**Deployment** — Dockerized backend + static frontend, both on Render (`render.yaml` Blueprint).

## Running locally

Backend:
```bash
python -m venv venv
venv/Scripts/activate       # or source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env        # fill in DB / Groq / Pinecone / B2 credentials
alembic upgrade head
python run_dev.py           # http://127.0.0.1:8001
```

Frontend:
```bash
cd web
npm install
cp .env.example .env        # set VITE_API_BASE_URL to the backend above
npm run dev                 # http://localhost:5173
```

## Deployment

The included `render.yaml` defines both services (Docker backend + static frontend). Push to `main` and connect the repo as a Render Blueprint; set the secret env vars (DB, Groq, Pinecone, B2 credentials, CORS origins) in the Render dashboard.
