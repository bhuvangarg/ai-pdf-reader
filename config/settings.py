import os

# ─── Base Paths ────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
UPLOAD_FOLDER = os.path.join(STORAGE_DIR, "uploads")
AUDIO_FOLDER = os.path.join(STORAGE_DIR, "audio")
EMBEDDINGS_DIR = os.path.join(STORAGE_DIR, "embeddings")
OCR_CACHE_FILE = os.path.join(STORAGE_DIR, "ocr_cache.db")   # SQLite cache
STATE_FILE = os.path.join(STORAGE_DIR, "state.json")          # last book/page

# ─── Groq ──────────────────────────────────────────────
import os

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"

# ─── PDF Rendering ─────────────────────────────────────
DISPLAY_SCALE = 2.0    # zoom factor for page images shown in UI (2× of 72 dpi = 144 dpi)
OCR_DPI = 150          # ⚡ REDUCED: was 300 — 150 dpi cuts memory ~4×, accuracy still good
                       # At 150 dpi: A4 page ≈ 1240×1754 px vs 2480×3508 at 300 dpi

# ─── OCR ───────────────────────────────────────────────
OCR_CONFIDENCE_THRESHOLD = 0.3
OCR_LANGUAGES = ["hi", "en"]

# ─── RAG ───────────────────────────────────────────────
RAG_MODEL_NAME = "all-MiniLM-L6-v2"
RAG_CHUNK_SIZE = 500
RAG_CHUNK_OVERLAP = 100
