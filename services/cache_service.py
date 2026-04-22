import json
import os
import sqlite3
import threading

from config.settings import OCR_CACHE_FILE

# One lock for all DB writes — SQLite WAL handles concurrent reads fine
_db_lock = threading.Lock()


# ─── Schema Bootstrap ──────────────────────────────────

def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ocr_cache (
            book_id   TEXT    NOT NULL,
            page      INTEGER NOT NULL,
            text      TEXT    NOT NULL DEFAULT '',
            bbox_data TEXT    NOT NULL DEFAULT '[]',
            PRIMARY KEY (book_id, page)
        )
    """)
    conn.commit()


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(OCR_CACHE_FILE), exist_ok=True)
    conn = sqlite3.connect(OCR_CACHE_FILE, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")   # faster concurrent access
    conn.execute("PRAGMA synchronous=NORMAL") # safe + faster than FULL
    _init_db(conn)
    return conn


# ─── Key Construction ──────────────────────────────────

def _book_id(pdf_path: str) -> str:
    basename = os.path.basename(pdf_path)
    size = os.path.getsize(pdf_path)
    return f"{basename}_{size}"


# ─── Public API ────────────────────────────────────────

def get_cached_page(pdf_path: str, page_index: int) -> dict | None:
    """
    Returns cached dict {"text": ..., "bbox_data": [...]} for the page,
    or None if not in cache.
    """
    bid = _book_id(pdf_path)
    try:
        conn = _connect()
        row = conn.execute(
            "SELECT text, bbox_data FROM ocr_cache WHERE book_id=? AND page=?",
            (bid, page_index),
        ).fetchone()
        conn.close()
        if row:
            return {"text": row[0], "bbox_data": json.loads(row[1])}
    except Exception as e:
        print(f"Cache read error: {e}")
    return None


def set_cached_page(pdf_path: str, page_index: int, text: str, bbox_data: list) -> None:
    """Persists OCR result for a single page (thread-safe)."""
    bid = _book_id(pdf_path)
    bbox_json = json.dumps(bbox_data, ensure_ascii=False)
    with _db_lock:
        try:
            conn = _connect()
            conn.execute(
                "INSERT OR REPLACE INTO ocr_cache (book_id, page, text, bbox_data) "
                "VALUES (?, ?, ?, ?)",
                (bid, page_index, text, bbox_json),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Cache write error: {e}")
