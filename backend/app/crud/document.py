from typing import List, Any
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.document import SessionDocument, DocumentChunk
from app.schemas.document import DocumentCreate, DocumentUpdate, ChunkCreate


class CRUDDocument(CRUDBase[SessionDocument, DocumentCreate, DocumentUpdate]):
    def get_by_session(self, db: Session, *, session_id: int) -> List[SessionDocument]:
        return db.query(self.model).filter(self.model.session_id == session_id).all()

    def get_by_user(self, db: Session, *, user_id: int) -> List[SessionDocument]:
        return db.query(self.model).filter(self.model.user_id == user_id).all()


class CRUDChunk(CRUDBase[DocumentChunk, ChunkCreate, Any]):
    def get_by_document(self, db: Session, *, document_id: int) -> List[DocumentChunk]:
        return db.query(self.model).filter(self.model.document_id == document_id).all()


document = CRUDDocument(SessionDocument)
chunk = CRUDChunk(DocumentChunk)
