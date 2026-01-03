from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class MemoryBase(BaseModel):
    content: str

class MemoryCreate(MemoryBase):
    pass

class MemoryUpdate(BaseModel):
    content: Optional[str] = None

class Memory(MemoryBase):
    id: int
    user_id: int
    created_at: datetime
    last_accessed_at: datetime

    model_config = ConfigDict(from_attributes=True)
