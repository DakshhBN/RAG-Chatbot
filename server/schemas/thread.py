import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ThreadCreate(BaseModel):
    document_id: uuid.UUID
    title: str | None = None


class ThreadRename(BaseModel):
    title: str | None = None


class ThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID | None
    title: str | None
    created_at: datetime


class MessageOut(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    content: str
