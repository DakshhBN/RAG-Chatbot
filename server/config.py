import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/rag_chatbot"
    CHECKPOINTER_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/rag_chatbot"

    JWT_SECRET_KEY: str = "change-me-in-.env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "rag-chatbot"

    EMBED_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBED_DIMENSION: int = 384

    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "rag-chatbot-documents"
    S3_REGION: str = "auto"

    # Capacity limits — kept small deliberately so the whole upload -> parse -> chunk
    # -> embed pipeline finishes in-process on a single free-tier web dyno with no
    # separate worker/queue. See plan's "Capacity limits" note.
    MAX_UPLOAD_MB: int = 10
    MAX_UPLOAD_PAGES: int = 150

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 150
    RETRIEVAL_TOP_K: int = 4

    # Plain string, not list[str] — pydantic-settings auto-JSON-decodes list-typed
    # env vars *before* any validator runs, so an empty/malformed value crashes
    # settings construction outright. Keeping this a str and parsing it ourselves
    # lets us fail soft instead.
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        value = self.CORS_ORIGINS.strip()
        if not value:
            return ["http://localhost:5173"]
        if value.startswith("["):
            return json.loads(value)
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


settings = Settings()
