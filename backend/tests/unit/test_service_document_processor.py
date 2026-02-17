from app.services.document_processor import DocumentProcessor
import os
import tempfile


def test_extract_text_txt():
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tf:
        tf.write(b"Hello world")
        tf_path = tf.name

    try:
        text = DocumentProcessor.extract_text(tf_path, "txt")
        assert text == "Hello world"
    finally:
        os.unlink(tf_path)


def test_chunk_text():
    text = "A" * 2500
    chunks = DocumentProcessor.chunk_text(text, chunk_size=1000, chunk_overlap=100)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 1000
