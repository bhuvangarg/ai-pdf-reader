import re


def clean_text(text: str) -> str:
    """
    Collapses multi-line paragraphs into single lines.
    Used before passing text to edge-tts.
    """
    paragraphs = text.split('\n\n')
    cleaned = []
    for para in paragraphs:
        para = para.replace('\n', ' ')
        para = re.sub(r' +', ' ', para).strip()
        if para:
            cleaned.append(para)
    return ' '.join(cleaned)


def extract_paragraphs(text: str) -> str:
    """
    Parses raw PDF text (with tab/newline artifacts) into clean paragraphs.
    Used during initial PDF load to build pages_data.
    """
    text = text.replace('\t', ' ')
    text = re.sub(r' +', ' ', text)

    lines = text.split('\n')
    paragraphs = []
    current = []

    for line in lines:
        line = line.strip()
        if not line:
            if current:
                paragraphs.append(' '.join(current))
                current = []
        else:
            current.append(line)

    if current:
        paragraphs.append(' '.join(current))

    return '\n\n'.join(paragraphs) if paragraphs else ""


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    """
    Splits a long text into overlapping word-level chunks for RAG indexing.
    """
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = words[start:end]
        chunks.append(" ".join(chunk))
        start += (chunk_size - overlap)

    return chunks
