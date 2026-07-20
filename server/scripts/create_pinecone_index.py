"""One-time setup: create the Pinecone index this project uses, if it doesn't
already exist. Safe to re-run.

Usage: python -m server.scripts.create_pinecone_index
"""

from server.vectorstore import ensure_index_exists

if __name__ == "__main__":
    ensure_index_exists()
    print("Pinecone index is ready.")
