import threading


class BookState:
    """
    Singleton holding all in-memory book state.
    Thread-safe via RLock — OCR worker thread and Flask request threads
    both read/write this state concurrently.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self):
        self._lock = threading.RLock()
        self.pages_data: list[str] = []
        self.pages_images: dict[int, str] = {}
        self.pages_ocr_text: dict[int, str] = {}
        self.pages_images_bbox: dict[int, list] = {}
        self.ocr_status: dict[int, str] = {}
        self.full_text: str = ""
        self.current_pdf_path: str = ""   # last loaded PDF path (for boost)

    def reset(self):
        """Called on every new PDF upload."""
        with self._lock:
            self._init()

    def get_page_text(self, num: int) -> str:
        with self._lock:
            if num in self.pages_ocr_text:
                return self.pages_ocr_text[num]
            if 0 <= num < len(self.pages_data):
                return self.pages_data[num]
        return ""

    def set_ocr_result(self, page_num: int, text: str, bbox_data: list) -> None:
        """Thread-safe write of OCR results for a page."""
        with self._lock:
            self.pages_ocr_text[page_num] = text
            self.pages_images_bbox[page_num] = bbox_data
            self.ocr_status[page_num] = "done"

    def set_page_image(self, page_num: int, b64: str) -> None:
        with self._lock:
            self.pages_images[page_num] = b64


# Module-level singleton — import this everywhere
book_state = BookState()
