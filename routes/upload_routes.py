import os

from flask import Blueprint, jsonify, request

from config.settings import UPLOAD_FOLDER
from models.book_model import book_state
from services.ocr_service import start_background_ocr
from services.pdf_service import get_pdf_path, load_pdf
from services.rag_service import rag_service
from services.state_service import save_state

upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("pdf")
    path = get_pdf_path()

    if file:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(path)
    elif not os.path.exists(path):
        return jsonify({"error": "No PDF found"}), 400

    page_count = load_pdf(path)
    print(f"✅ {page_count} pages loaded — starting priority OCR...")

    # Priority order: page 0 (current) → 1 (next) → last (prev) → rest
    all_pages = list(range(page_count))
    seen = set()
    priority_pages = []
    for p in [0, 1, page_count - 1]:
        if 0 <= p < page_count and p not in seen:
            priority_pages.append(p)
            seen.add(p)
    for p in all_pages:
        if p not in seen:
            priority_pages.append(p)
            seen.add(p)

    start_background_ocr(path, priority_pages)

    # Build RAG — load from disk cache if same file was seen before
    rag_service.load_or_create(book_state.full_text, path)

    # Persist last-opened state
    book_state.current_pdf_path = path
    save_state({"last_page": 0, "total_pages": page_count, "pdf_path": path})

    return jsonify({
        "total_pages": page_count,
        "first_page": book_state.pages_data[0] if book_state.pages_data else "",
    })
