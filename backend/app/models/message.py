from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    session_id = Column(
        Integer, ForeignKey("chat_sessions.id"), index=True, nullable=True
    )
    content = Column(Text)
    model = Column(String, index=True)
    response = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = {"mysql_engine": "InnoDB"}
