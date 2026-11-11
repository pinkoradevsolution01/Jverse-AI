from pathlib import Path


SUPPORTED_SUFFIXES = {".pdf", ".docx", ".txt", ".md", ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".sql", ".yaml", ".yml"}


class KnowledgePipeline:
    """Extraction/chunking boundary; vector persistence is a Supabase adapter concern."""
    def extract(self, source: bytes, name: str) -> str:
        suffix = Path(name).suffix.lower()
        if suffix not in SUPPORTED_SUFFIXES:
            raise ValueError("unsupported_knowledge_file")
        if suffix in {".txt", ".md", ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".sql", ".yaml", ".yml"}:
            return source.decode("utf-8", errors="replace")
        if suffix == ".pdf":
            from pypdf import PdfReader
            from io import BytesIO
            return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(source)).pages)
        from docx import Document
        from io import BytesIO
        return "\n".join(paragraph.text for paragraph in Document(BytesIO(source)).paragraphs)

    @staticmethod
    def chunk(text: str, size: int = 1_200, overlap: int = 160) -> list[str]:
        text = text.strip()
        if not text:
            return []
        chunks: list[str] = []
        offset = 0
        while offset < len(text):
            end = min(len(text), offset + size)
            boundary = text.rfind("\n", offset, end)
            if boundary > offset + size // 2:
                end = boundary
            chunks.append(text[offset:end].strip())
            offset = max(end - overlap, offset + 1)
        return [chunk for chunk in chunks if chunk]
