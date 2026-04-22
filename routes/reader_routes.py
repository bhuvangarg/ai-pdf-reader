from flask import Blueprint, jsonify, render_template, request

from models.book_model import book_state
from services.ocr_service import boost_page_priority
from services.state_service import load_state, save_state

reader_bp = Blueprint("reader", __name__)


@reader_bp.route("/")
def home():
    return render_template("index.html")


@reader_bp.route("/page/<int:num>")
def get_page(num):
    if not (0 <= num < len(book_state.pages_data)):
        return jsonify({"error": "Page not found"}), 404

    return jsonify({
        "text":       book_state.get_page_text(num),
        "page":       num,
        "ocr_status": book_state.ocr_status.get(num, "pending"),
    })


@reader_bp.route("/page-image/<int:num>")
def get_page_image(num):
    if num not in book_state.pages_images:
        return jsonify({"error": "Image not found"}), 404

    # Boost OCR priority for this page and its neighbours
    if book_state.current_pdf_path:
        boost_page_priority(book_state.current_pdf_path, num)

    return jsonify({
        "image":      book_state.pages_images[num],
        "ocr_status": book_state.ocr_status.get(num, "pending"),
        "bbox_data":  book_state.pages_images_bbox.get(num, []),
        "page":       num,
    })


@reader_bp.route("/ocr-status/<int:num>")
def get_ocr_status(num):
    return jsonify({
        "status":    book_state.ocr_status.get(num, "pending"),
        "bbox_data": book_state.pages_images_bbox.get(num, []),
        "page":      num,
    })


# ─── State Persistence ─────────────────────────────────

@reader_bp.route("/state/save", methods=["POST"])
def state_save():
    """Frontend calls this on page navigation to persist current position."""
    data = request.get_json() or {}
    page = data.get("page")
    if page is not None:
        save_state({"last_page": page})
    return jsonify({"ok": True})


@reader_bp.route("/state/load", methods=["GET"])
def state_load():
    """Returns last persisted state so frontend can resume after server restart."""
    return jsonify(load_state())
