import base64
import io

import fitz
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def render_page_to_b64(page: fitz.Page, scale: float = 2.0) -> str:
    """
    Renders a fitz.Page to a base64-encoded PNG string at the given scale.
    Used for displaying page images in the UI.
    """
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    return base64.b64encode(img_bytes).decode("utf-8")


def render_page_to_array(page: fitz.Page, dpi: int = 150) -> tuple[np.ndarray, tuple[int, int]]:
    """
    Renders a fitz.Page at the given DPI and returns:
      - numpy array suitable for EasyOCR (after preprocessing)
      - (width, height) in pixels of the rendered image

    Default DPI is 150 (reduced from 300) to avoid ~1 GB RAM spikes.
    At 150 DPI an A4 page is ~1240x1754 px — sufficient for EasyOCR accuracy.
    Bounding boxes are stored as percentages of this image, so overlay alignment
    is DPI-independent as long as we use these dimensions as the reference.
    """
    scale = dpi / 72.0
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_bytes))
    img_width, img_height = img.size   # (width, height)

    processed = _preprocess_for_ocr(img)
    return np.array(processed), (img_width, img_height)


def _preprocess_for_ocr(img: Image.Image) -> Image.Image:
    """
    Applies preprocessing to improve EasyOCR accuracy:
      1. Convert to grayscale  -> reduces colour noise
      2. Boost contrast        -> makes characters crisper
      3. Mild sharpen          -> recovers edges
      4. Back to RGB           -> EasyOCR expects 3-channel input
    """
    gray = img.convert("L")
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(1.8)
    sharpened = enhanced.filter(ImageFilter.SHARPEN)
    return sharpened.convert("RGB")
