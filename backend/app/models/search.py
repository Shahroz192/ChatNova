from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    query = Column(String, index=True)
    search_type = Column(String, default="general")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="search_history")
