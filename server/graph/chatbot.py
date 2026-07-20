from functools import lru_cache

from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_groq import ChatGroq
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph

from server.config import settings
from server.embeddings import embed_query
from server.graph.state import ChatState
from server.vectorstore import query_namespace

SYSTEM_PROMPT_TEMPLATE = (
    "Answer ONLY from the provided context. If the answer isn't found in the "
    "context, say you don't know — do not use outside knowledge.\n\n"
    "CONTEXT:\n{context}"
)


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    return ChatGroq(model=settings.GROQ_MODEL, api_key=settings.GROQ_API_KEY)


def retrieve_node(state: ChatState, config: RunnableConfig) -> dict:
    document_id = config["configurable"]["document_id"]
    query = state["messages"][-1].content
    query_vector = embed_query(query)
    matches = query_namespace(namespace=document_id, vector=query_vector, top_k=settings.RETRIEVAL_TOP_K)
    context = "\n\n".join(m["metadata"].get("text", "") for m in matches) if matches else ""
    return {"context": context}


def chat_node(state: ChatState) -> dict:
    # The system+context message is built fresh every turn and only fed to the LLM
    # call below — it's never returned into `messages`, so it never gets persisted
    # into (or duplicated across) the checkpointed conversation history.
    system = SystemMessage(content=SYSTEM_PROMPT_TEMPLATE.format(context=state.get("context", "")))
    response = get_llm().invoke([system, *state["messages"]])
    return {"messages": [response]}


def build_graph(checkpointer: AsyncPostgresSaver):
    graph = StateGraph(ChatState)
    graph.add_node("retrieve_node", retrieve_node)
    graph.add_node("chat_node", chat_node)
    graph.add_edge(START, "retrieve_node")
    graph.add_edge("retrieve_node", "chat_node")
    graph.add_edge("chat_node", END)
    return graph.compile(checkpointer=checkpointer)
