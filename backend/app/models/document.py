from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, ARRAY, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base, engine
from sqlalchemy import text

# Determine if pgvector is available
try:
    with engine.connect() as conn:
        res = conn.execute(
            text("SELECT count(*) FROM pg_type WHERE typname = 'vector'")
        ).scalar()
        has_vector = res > 0
except Exception:
    has_vector = False

if has_vector:
    from pgvector.sqlalchemy import Vector

    embedding_type = Vector(768)
else:
    embedding_type = ARRAY(Float)


class SessionDocument(Base):
    __tablename__ = "session_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf, image, docx, txt, etc.
    session_id = Column(
        Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    message_id = Column(
        Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="documents")
    message = relationship("Message", back_populates="documents")
    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer, ForeignKey("session_documents.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, nullable=False)
    embedding = Column(embedding_type)  # Size depends on the embedding model
    page_number = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("SessionDocument", back_populates="chunks")
