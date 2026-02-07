from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class SearchHistoryBase(BaseModel):
    query: str
    search_type: Optional[str] = "general"

class SearchHistoryCreate(SearchHistoryBase):
    pass

class SearchHistory(SearchHistoryBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
