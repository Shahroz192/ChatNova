from typing import List
import fitz  # PyMuPDF
from docx import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter


class DocumentProcessor:
    @staticmethod
    def _sanitize_text(text: str) -> str:
        # Remove NUL characters which break SQL inserts and some parsers.
        if not text:
            return ""
        return text.replace("\x00", "")

    @staticmethod
    def extract_text(file_path: str, file_type: str) -> str:
        """Extract text from various file types."""
        if file_type.lower() == "pdf":
            text = ""
            with fitz.open(file_path) as doc:
                for page in doc:
                    text += page.get_text()
            return DocumentProcessor._sanitize_text(text)
        elif file_type.lower() in ["docx", "doc"]:
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return DocumentProcessor._sanitize_text(text)
        elif file_type.lower() in ["txt", "md", "markdown"]:
            with open(file_path, "r", encoding="utf-8") as f:
                return DocumentProcessor._sanitize_text(f.read())
        else:
            # Fallback or unsupported
            return ""

    @staticmethod
    def chunk_text(
        text: str, chunk_size: int = 1000, chunk_overlap: int = 100
    ) -> List[str]:
        """Split text into manageable chunks."""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        return splitter.split_text(DocumentProcessor._sanitize_text(text))
