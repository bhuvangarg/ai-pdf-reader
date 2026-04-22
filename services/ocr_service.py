import queue
import threading

import fitz

from config.settings import OCR_CONFIDENCE_THRESHOLD, OCR_LANGUAGES, OCR_DPI
from models.book_model import book_state
from services.cache_service import get_cached_page, set_cached_page
from services.rag_service import rag_service
from utils.image_utils import render_page_to_array

# ─── Lazy OCR Reader ───────────────────────────────────

_ocr_reader = None
_reader_lock = threading.Lock()


def get_ocr_reader():
    """Thread-safe lazy initializer for EasyOCR."""
    global _ocr_reader
    if _ocr_reader is None:
        with _reader_lock:
            if _ocr_reader is None:
                import easyocr
                print("🔄 Loading EasyOCR model...")
                _ocr_reader = easyocr.Reader(OCR_LANGUAGES, gpu=False)
                print("✅ EasyOCR ready!")
    return _ocr_reader


# ─── Priority Work Queue ───────────────────────────────
# Items: (priority_int, (pdf_path, page_num))
# Lower int = higher priority.  Current page → 0, neighbours → 1, rest → 10+

_work_queue: queue.PriorityQueue = queue.PriorityQueue()
_enqueued: set = set()          # (pdf_path, page_num) pairs already queued
_enqueue_lock = threading.Lock()
_worker_running = False
_worker_lock = threading.Lock()


def _enqueue(pdf_path: str, page_num: int, priority: int) -> None:
    key = (pdf_path, page_num)
    with _enqueue_lock:
        if key not in _enqueued and book_state.ocr_status.get(page_num) != "done":
            _enqueued.add(key)
            _work_queue.put((priority, key))


# ─── Single-Page OCR ───────────────────────────────────

def _process_page(reader, doc: fitz.Document, pdf_path: str, page_num: int) -> None:
    """Runs OCR on one page and updates book_state + cache."""
    try:
        # ── Cache check ──────────────────────────────
        cached = get_cached_page(pdf_path, page_num)
        if cached:
            book_state.set_ocr_result(
                page_num,
                cached["text"],
                cached.get("bbox_data", []),
            )
            print(f"✅ Cache hit: page {page_num + 1}")
            return

        book_state.ocr_status[page_num] = "processing"

        # ── Render at reduced DPI (memory-safe) ──────
        # OCR_DPI=150 → A4 ≈ 1240×1754 px  (~6 MB array vs ~26 MB at 300 DPI)
        img_array, (img_w, img_h) = render_page_to_array(doc[page_num], dpi=OCR_DPI)

        # ── Run EasyOCR ──────────────────────────────
        results = reader.readtext(img_array, detail=1, paragraph=False)

        bbox_data = []
        full_texts = []

        for (bbox, text, conf) in results:
            if conf < OCR_CONFIDENCE_THRESHOLD or not text.strip():
                continue

            x1 = min(p[0] for p in bbox)
            y1 = min(p[1] for p in bbox)
            x2 = max(p[0] for p in bbox)
            y2 = max(p[1] for p in bbox)

            # Percentages relative to OCR image dims —
            # frontend overlay uses same % on display image → pixel-perfect alignment
            bbox_data.append({
                "text":   text,
                "left":   round((x1 / img_w) * 100, 2),
                "top":    round((y1 / img_h) * 100, 2),
                "width":  round(((x2 - x1) / img_w) * 100, 2),
                "height": round(((y2 - y1) / img_h) * 100, 2),
                "conf":   round(conf, 2),
            })
            full_texts.append(text)

        ocr_text = " ".join(full_texts)
        final_text = ocr_text if ocr_text.strip() else book_state.pages_data[page_num]

        book_state.set_ocr_result(page_num, final_text, bbox_data)
        set_cached_page(pdf_path, page_num, final_text, bbox_data)
        print(f"✅ OCR done: page {page_num + 1}")

    except Exception as e:
        print(f"❌ OCR error page {page_num}: {e}")
        book_state.set_ocr_result(
            page_num,
            book_state.pages_data[page_num] if page_num < len(book_state.pages_data) else "",
            [],
        )
        book_state.ocr_status[page_num] = "error"


# ─── Background Worker ─────────────────────────────────

def _ocr_worker(pdf_path: str) -> None:
    global _worker_running
    try:
        reader = get_ocr_reader()
    except Exception as e:
        print(f"❌ OCR model load failed: {e}")
        _worker_running = False
        return

    doc = fitz.open(pdf_path)

    while True:
        try:
            _priority, (p_path, page_num) = _work_queue.get(timeout=10)
            _process_page(reader, doc, p_path, page_num)
            _work_queue.task_done()
        except queue.Empty:
            break
        except Exception as e:
            print(f"❌ Worker error: {e}")
            _work_queue.task_done()

    doc.close()

    # ── Refresh RAG after all OCR done ───────────────
    try:
        full_ocr = " ".join(
            book_state.pages_ocr_text.get(i, "")
            for i in range(len(book_state.pages_data))
        )
        rag_service.create_embeddings(full_ocr, pdf_path)
        print("✅ RAG updated with OCR text!")
    except Exception as e:
        print(f"❌ RAG update failed: {e}")

    with _worker_lock:
        _worker_running = False


# ─── Public API ────────────────────────────────────────

def start_background_ocr(pdf_path: str, page_nums: list[int]) -> None:
    """
    Enqueues pages with priority scheduling:
      - page_nums[0]  → priority 0  (current page, shown immediately)
      - page_nums[1]  → priority 1  (next page)
      - page_nums[2]  → priority 2  (previous page)
      - rest          → priority 10+
    Spawns a single daemon worker thread if not already running.
    """
    global _worker_running

    with _enqueue_lock:
        _enqueued.clear()

    for idx, page in enumerate(page_nums):
        priority = idx if idx < 3 else 10 + idx
        _enqueue(pdf_path, page, priority)

    with _worker_lock:
        if not _worker_running:
            _worker_running = True
            threading.Thread(
                target=_ocr_worker,
                args=(pdf_path,),
                daemon=True,
            ).start()


def boost_page_priority(pdf_path: str, page_num: int) -> None:
    """
    Call when user navigates to a page — bumps it (and neighbours) to front
    of queue so OCR completes ASAP for the visible page.
    """
    if book_state.ocr_status.get(page_num) == "done":
        return
    n_pages = len(book_state.pages_data)
    for delta, pri in [(0, 0), (1, 1), (-1, 2)]:
        p = page_num + delta
        if 0 <= p < n_pages:
            _enqueue(pdf_path, p, pri)
