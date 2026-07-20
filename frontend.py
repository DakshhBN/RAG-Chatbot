import os
from pathlib import Path
import streamlit as st
from backend import chatbot, retrieve_all_threads
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
from streamlit_chat import message

# ------------------- IMPORT YOUR RAG PIPELINE -------------------
try:
    from backend import setup_pipeline_and_query, PDF_PATH as DEFAULT_PDF
except Exception as e:
    DEFAULT_PDF = os.getenv("PDF_PATH", "Biology.pdf")
    setup_pipeline_and_query = None
    IMPORT_ERR = e
else:
    IMPORT_ERR = None

load_dotenv()

# ------------------- PAGE CONFIG & STYLING -------------------
#st.set_page_config(page_title="AskGini", page_icon="🤖", layout="centered")

st.markdown("""
<style>
.stApp { background-color: #0E1117; color: #FAFAFA; }
.stTextInput textarea { background-color: #1b1e24; color: #FAFAFA; border-radius: 8px; }
footer { visibility: hidden; }
[data-testid="stChatMessage"] { border-radius: 10px; padding: 0.6rem 1rem; margin-bottom: 0.6rem; }
.stButton>button { background-color: #fca311; color: black; border-radius: 8px; height: 2.2rem; border: none; font-weight: bold; }
.stButton>button:hover { background-color: #ffb703; }
</style>
""", unsafe_allow_html=True)

st.title("AskGini")
#st.caption("Ask questions from your **hardcoded PDF** using your local Ollama model — no uploads, no distractions.")

# ------------------- IMPORT / PDF CHECKS -------------------
if IMPORT_ERR:
    st.error("Could not import `rag.py`. Ensure it’s in the same folder.")
    st.exception(IMPORT_ERR)
    st.stop()

if not Path(DEFAULT_PDF).exists():
    st.error(f"Hardcoded PDF not found: `{DEFAULT_PDF}` — place it in your project folder.")
    st.stop()

# ------------------- SESSION STATE -------------------
if "messages" not in st.session_state:
    st.session_state.messages = []  # [{"content": str, "is_user": bool}]

# ------------------- CLEAR CHAT BUTTON -------------------
clear_col, _ = st.columns([1, 6])
if clear_col.button("Clear"):
    st.session_state.messages = []
    st.rerun()  # ✅ modern Streamlit method

# ------------------- DISPLAY CHAT HISTORY -------------------
for i, msg in enumerate(st.session_state.messages):
    if msg["is_user"]:
        message(msg["content"], is_user=True, avatar_style="adventurer", seed="user", key=f"user_{i}")
    else:
        message(msg["content"], is_user=False, avatar_style="bottts", seed="bot", key=f"bot_{i}")

st.markdown("---")

# ------------------- INPUT FORM -------------------
with st.form(key="ask_form", clear_on_submit=True):
    user_input = st.text_input("💭 Ask your question:", placeholder="e.g., What is DNA?", key="input_box")
    submit = st.form_submit_button("Ask")

# ------------------- HANDLE SUBMIT -------------------
if submit and user_input:
    # Append user message
    st.session_state.messages.append({"content": user_input, "is_user": True})

    # Generate bot response
    with st.spinner("💭 Thinking..."):
        try:
            if setup_pipeline_and_query is None:
                raise RuntimeError("RAG pipeline not available.")
            answer = setup_pipeline_and_query(DEFAULT_PDF, user_input)
        except Exception as e:
            answer = f"⚠️ Error: {type(e).__name__} — {e}"

    # Append bot reply
    st.session_state.messages.append({"content": answer, "is_user": False})

    # ✅ Use modern rerun method (no deprecated experimental functions)
    st.rerun()

# ------------------- FOOTER -------------------
st.markdown("---")
#st.caption(f"📘 Using hardcoded PDF: `{DEFAULT_PDF}` • Indices stored under `.indices/` • Powered by Ollama 🤖")
