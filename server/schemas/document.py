import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from server.models.document import DocumentStatus


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_filename: str
    status: DocumentStatus
    page_count: int | None
    error_message: str | None
    created_at: datetime
