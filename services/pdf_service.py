import os

import fitz

from config.settings import UPLOAD_FOLDER, DISPLAY_SCALE
from models.book_model import book_state
from utils.image_utils import render_page_to_b64
from utils.text_utils import extract_paragraphs


def get_pdf_path() -> str:
    return os.path.join(UPLOAD_FOLDER, "book.pdf")


def load_pdf(path: str) -> int:
    """
    Opens the PDF, extracts per-page text and display images,
    resets and populates book_state.
    Returns total page count.
    """
    book_state.reset()
    doc = fitz.open(path)

    for i in range(doc.page_count):
        try:
            page = doc[i]

            # Display image (2× zoom for crisp UI rendering)
            b64 = render_page_to_b64(page, scale=DISPLAY_SCALE)
            book_state.pages_images[i] = b64

            # Raw text from PyMuPDF as fallback before OCR completes
            raw_text = page.get_text("text").strip()
            final_text = extract_paragraphs(raw_text)

            book_state.pages_data.append(final_text)
            book_state.pages_ocr_text[i] = final_text
            book_state.pages_images_bbox[i] = []
            book_state.ocr_status[i] = "pending"

        except Exception as e:
            print(f"Page {i} load error: {e}")
            book_state.pages_data.append("")
            book_state.pages_ocr_text[i] = ""
            book_state.pages_images_bbox[i] = []
            book_state.ocr_status[i] = "error"

    doc.close()
    book_state.full_text = " ".join(book_state.pages_data)

    return len(book_state.pages_data)
