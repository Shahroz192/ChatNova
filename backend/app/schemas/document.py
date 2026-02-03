from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime


class DocumentBase(BaseModel):
    filename: str
    file_type: str
    session_id: int


class DocumentCreate(DocumentBase):
    user_id: int


class DocumentUpdate(BaseModel):
    pass


class Document(DocumentBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChunkBase(BaseModel):
    content: str
    page_number: Optional[int] = None


class ChunkCreate(ChunkBase):
    document_id: int
    embedding: List[float]


class Chunk(ChunkBase):
    id: int
    document_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
