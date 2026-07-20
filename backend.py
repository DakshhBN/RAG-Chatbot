
import os
import json
import hashlib
from pathlib import Path 

from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver

from dotenv import load_dotenv

from langsmith import traceable

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

from sentence_transformers import SentenceTransformer

# Ollama client
from langchain_ollama import ChatOllama
from ollama import Client as OllamaClient
import sqlite3

load_dotenv()


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

def chat_node(state: ChatState):
    messages = state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}


conn = sqlite3.connect(database='chatbot.db', check_same_thread=False)
# Checkpointer
checkpointer = SqliteSaver(conn=conn)

graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)

chatbot = graph.compile(checkpointer=checkpointer)

def retrieve_all_threads():
    all_threads = set()
    for checkpoint in checkpointer.list(None):
        all_threads.add(checkpoint.config['configurable']['thread_id'])

    return list(all_threads)


# Config
PDF_PATH = os.getenv("PDF_PATH", "Biology.pdf")
INDEX_ROOT = Path(os.getenv("INDEX_ROOT", ".indices"))
INDEX_ROOT.mkdir(exist_ok=True)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")
EMBED_MODEL = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")

SYSTEM_PROMPT = "Answer ONLY from the provided context. If not found, say you don't know."

# ----------------- local embedding wrapper -----------------
from sentence_transformers import SentenceTransformer

class SentenceTransformerEmbeddings:
    """
    Compatible with FAISS.from_documents / load_local.
    - embed_documents(list[str]) -> list[list[float]]
    - embed_query(str) -> list[float]
    - __call__(text_or_list) -> delegates to embed_query or embed_documents
      so it works with older/newer LangChain/FAISS expectations.
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self._model = SentenceTransformer(model_name)

    def embed_documents(self, texts):
        # texts: list[str] -> returns list[list[float]]
        embs = self._model.encode(texts, show_progress_bar=False)
        return [emb.tolist() for emb in embs]

    def embed_query(self, text):
        # text: str -> returns list[float]
        emb = self._model.encode([text], show_progress_bar=False)[0]
        return emb.tolist()

    def __call__(self, texts):
        """
        Make the object callable. FAISS/langchain sometimes calls the embedding
        function directly (passing either a single string or a list of strings).
        This handles both cases and returns the shape that callers expect.
        """
        if isinstance(texts, str):
            return self.embed_query(texts)
        # if it's an iterable of strings -> embed_documents
        if isinstance(texts, (list, tuple)):
            # The caller might expect a single embedding (for a single query)
            # or a list of embeddings. We'll return list-of-lists for list input.
            return self.embed_documents(list(texts))
        raise TypeError(f"Unsupported type for embeddings call: {type(texts)}")


# ----------------- helpers (traced) -----------------
@traceable(name="load_pdf")
def load_pdf(path: str):
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"PDF not found at {path}. Please copy the PDF into the project folder or set PDF_PATH.")
    return PyPDFLoader(path).load()  # list[Document]

@traceable(name="split_documents")
def split_documents(docs, chunk_size=1000, chunk_overlap=150):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return splitter.split_documents(docs)

@traceable(name="build_vectorstore")
def build_vectorstore(splits, embed_model_name: str):
    emb = SentenceTransformerEmbeddings(model_name=embed_model_name)
    return FAISS.from_documents(splits, emb)

# ----------------- cache key / fingerprint -----------------
def _file_fingerprint(path: str) -> dict:
    p = Path(path)
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return {"sha256": h.hexdigest(), "size": p.stat().st_size, "mtime": int(p.stat().st_mtime)}

def _index_key(pdf_path: str, chunk_size: int, chunk_overlap: int, embed_model_name: str) -> str:
    meta = {
        "pdf_fingerprint": _file_fingerprint(pdf_path),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "embedding_model": embed_model_name,
        "format": "v1",
    }
    return hashlib.sha256(json.dumps(meta, sort_keys=True).encode("utf-8")).hexdigest()

# ----------------- explicitly traced load/build runs -----------------
@traceable(name="load_index", tags=["index"])
def load_index_run(index_dir: Path, embed_model_name: str):
    emb = SentenceTransformerEmbeddings(model_name=embed_model_name)
    return FAISS.load_local(str(index_dir), emb, allow_dangerous_deserialization=True)

@traceable(name="build_index", tags=["index"])
def build_index_run(pdf_path: str, index_dir: Path, chunk_size: int, chunk_overlap: int, embed_model_name: str):
    docs = load_pdf(pdf_path)  # child
    splits = split_documents(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap)  # child
    vs = build_vectorstore(splits, embed_model_name)  # child
    index_dir.mkdir(parents=True, exist_ok=True)
    vs.save_local(str(index_dir))
    (index_dir / "meta.json").write_text(json.dumps({
        "pdf_path": os.path.abspath(pdf_path),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "embedding_model": embed_model_name,
    }, indent=2))
    return vs

# ----------------- dispatcher (not traced) -----------------
def load_or_build_index(
    pdf_path: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    embed_model_name: str = EMBED_MODEL,
    force_rebuild: bool = False,
):
    key = _index_key(pdf_path, chunk_size, chunk_overlap, embed_model_name)
    index_dir = INDEX_ROOT / key
    cache_hit = index_dir.exists() and not force_rebuild
    if cache_hit:
        print(f"✅ Using existing index: {index_dir}")
        return load_index_run(index_dir, embed_model_name)
    else:
        print(f"🛠️ Building new index at: {index_dir}")
        return build_index_run(pdf_path, index_dir, chunk_size, chunk_overlap, embed_model_name)

# ----------------- prompt formatting -----------------
def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)

# ----------------- Ollama client helper -----------------
def ollama_generate(system: str, human_question: str, context: str, model: str = None):
    model = model or OLLAMA_MODEL
    client = OllamaClient(host=OLLAMA_HOST)
    # Simple composed prompt
    prompt = f"SYSTEM: {system}\n\nCONTEXT:\n{context}\n\nUSER: {human_question}\n\nAssistant:"
    resp = client.generate(model=model, prompt=prompt)
    # Try to return .response (client's usual attribute)
    try:
        return resp.response
    except Exception:
        return str(resp)

# ----------------- pipeline -----------------
@traceable(name="setup_pipeline", tags=["setup"])
def setup_pipeline(pdf_path: str, chunk_size=1000, chunk_overlap=150, embed_model_name=EMBED_MODEL, force_rebuild=False):
    return load_or_build_index(
        pdf_path=pdf_path,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        embed_model_name=embed_model_name,
        force_rebuild=force_rebuild,
    )

@traceable(name="pdf_rag_full_run")
def setup_pipeline_and_query(
    pdf_path: str,
    question: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    embed_model_name: str = EMBED_MODEL,
    force_rebuild: bool = False,
    ollama_model: str = None,
):
    vectorstore = setup_pipeline(pdf_path, chunk_size, chunk_overlap, embed_model_name, force_rebuild)

    # --- stable retrieval call ---
    docs = vectorstore.similarity_search(question, k=4)

    if not docs:
        return "I don't know — no relevant documents found in the PDF."

    context = format_docs(docs)

    # call Ollama local model
    response_text = ollama_generate(SYSTEM_PROMPT, question, context, model=ollama_model)
    return response_text

# ----------------- CLI -----------------
if __name__ == "__main__":
    print("PDF RAG (Ollama) ready. Ask a question (or Ctrl+C to exit).")
    q = input("\nQ: ").strip()
    try:
        ans = setup_pipeline_and_query(PDF_PATH, q)
    except FileNotFoundError as e:
        print("⚠️", e)
        raise
    except Exception as e:
        print("Error during pipeline:", type(e).__name__, e)
        raise
    print("\nA:", ans)
