from dataclasses import dataclass, field
from typing import List


@dataclass
class BBoxEntry:
    text: str
    left: float    # % from left edge
    top: float     # % from top edge
    width: float   # % of image width
    height: float  # % of image height
    conf: float    # OCR confidence score


@dataclass
class PageData:
    index: int
    raw_text: str = ""
    ocr_text: str = ""
    image_b64: str = ""
    bbox_data: List[dict] = field(default_factory=list)
    ocr_status: str = "pending"
