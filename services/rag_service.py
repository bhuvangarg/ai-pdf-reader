import os
import pickle
import threading

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from config.settings import (
    EMBEDDINGS_DIR,
    RAG_CHUNK_OVERLAP,
    RAG_CHUNK_SIZE,
    RAG_MODEL_NAME,
)
from utils.text_utils import chunk_text


class RAGService:
    """
    Encapsulates all RAG state (model, chunks, FAISS index).
    Embeddings are persisted per-book to disk and reloaded on subsequent
    uploads of the same file — avoiding repeated heavy encode() calls.
    """

    def __init__(self):
        self._model: SentenceTransformer | None = None
        self._model_lock = threading.Lock()
        self._rag_lock = threading.Lock()
        self.chunks: list[str] = []
        self.embeddings: np.ndarray | None = None
        self.index: faiss.Index | None = None
        self._current_book_id: str = ""

    # ─── Lazy model ───────────────────────────────────

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    print("🔄 Loading SentenceTransformer model...")
                    self._model = SentenceTransformer(RAG_MODEL_NAME)
                    print("✅ SentenceTransformer ready!")
        return self._model

    # ─── Book ID ──────────────────────────────────────

    @staticmethod
    def _book_id(pdf_path: str) -> str:
        basename = os.path.basename(pdf_path)
        size = os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 0
        return f"{basename}_{size}"

    # ─── Disk paths ───────────────────────────────────

    @staticmethod
    def _paths(book_id: str) -> tuple[str, str]:
        os.makedirs(EMBEDDINGS_DIR, exist_ok=True)
        safe = book_id.replace(" ", "_").replace("/", "_").replace("\\", "_")
        return (
            os.path.join(EMBEDDINGS_DIR, f"{safe}.npy"),
            os.path.join(EMBEDDINGS_DIR, f"{safe}_chunks.pkl"),
        )

    # ─── Load existing embeddings ─────────────────────

    def _try_load(self, book_id: str) -> bool:
        emb_path, chunks_path = self._paths(book_id)
        if not (os.path.exists(emb_path) and os.path.exists(chunks_path)):
            return False
        try:
            embeddings = np.load(emb_path)
            with open(chunks_path, "rb") as f:
                chunks = pickle.load(f)
            dim = embeddings.shape[1]
            idx = faiss.IndexFlatL2(dim)
            idx.add(np.array(embeddings, dtype=np.float32))
            with self._rag_lock:
                self.embeddings = embeddings
                self.chunks = chunks
                self.index = idx
                self._current_book_id = book_id
            print(f"✅ RAG: loaded {len(chunks)} cached chunks for '{book_id}'")
            return True
        except Exception as e:
            print(f"RAG load error: {e}")
        return False

    # ─── Save embeddings ──────────────────────────────

    def _save(self, book_id: str) -> None:
        emb_path, chunks_path = self._paths(book_id)
        try:
            np.save(emb_path, self.embeddings)
            with open(chunks_path, "wb") as f:
                pickle.dump(self.chunks, f)
        except Exception as e:
            print(f"RAG save error: {e}")

    # ─── Main API ─────────────────────────────────────

    def load_or_create(self, text: str, pdf_path: str) -> None:
        """
        If embeddings already exist for this exact file (name + size),
        load from disk.  Otherwise encode from scratch and persist.
        """
        book_id = self._book_id(pdf_path)
        if book_id == self._current_book_id and self.index is not None:
            return  # already in memory for this book
        if self._try_load(book_id):
            return
        self.create_embeddings(text, pdf_path)

    def create_embeddings(self, text: str, pdf_path: str = "") -> None:
        """
        Build FAISS index from text.  If pdf_path given, persist to disk.
        Thread-safe — called from both Flask thread and OCR worker.
        """
        if not text or not text.strip():
            print("⚠️ RAG: empty text — skipping")
            return

        raw_chunks = chunk_text(text, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP)
        chunks = [c for c in raw_chunks if c.strip()]
        if not chunks:
            return

        embeddings = self.model.encode(chunks, show_progress_bar=False)
        if embeddings is None or len(embeddings) == 0:
            return

        dim = embeddings.shape[1]
        idx = faiss.IndexFlatL2(dim)
        idx.add(np.array(embeddings, dtype=np.float32))

        book_id = self._book_id(pdf_path) if pdf_path else ""

        with self._rag_lock:
            self.chunks = chunks
            self.embeddings = embeddings
            self.index = idx
            self._current_book_id = book_id

        if pdf_path:
            self._save(book_id)

        print(f"✅ RAG: indexed {len(chunks)} chunks")

    # ─── Semantic Search ──────────────────────────────

    def search_chunks(self, query: str, top_k: int = 3) -> list[str]:
        with self._rag_lock:
            if self.index is None or not self.chunks:
                return []
            q_emb = self.model.encode([query])
            distances, indices = self.index.search(
                np.array(q_emb, dtype=np.float32), top_k
            )
            return [
                self.chunks[i]
                for i in indices[0]
                if 0 <= i < len(self.chunks)
            ]


# Module-level singleton
rag_service = RAGService()
