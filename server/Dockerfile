FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the fastembed model into the image so the first request in a
# fresh container doesn't pay a slow cold-start fetching it from HuggingFace.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

COPY server server
COPY alembic.ini alembic.ini

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m server.scripts.create_pinecone_index && uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
