import asyncio
import hashlib
import os
import sys

import edge_tts
from groq import Groq

from config.settings import AUDIO_FOLDER, GROQ_API_KEY, GROQ_MODEL
from utils.text_utils import clean_text

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# ─── Audio Path Helpers ────────────────────────────────

def get_page_audio_path(page_num: int, voice: str) -> str:
    safe_voice = voice.replace("-", "_")
    return os.path.join(AUDIO_FOLDER, f"page_{page_num}_{safe_voice}.mp3")


def get_selected_audio_path(text: str, voice: str) -> str:
    text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
    safe_voice = voice.replace("-", "_")
    return os.path.join(AUDIO_FOLDER, f"selected_{text_hash}_{safe_voice}.mp3")


def get_explanation_audio_path() -> str:
    return os.path.join(AUDIO_FOLDER, "explanation.mp3")


# ─── Audio Generation (with caching) ──────────────────

async def _generate_async(text: str, path: str, voice: str) -> None:
    cleaned = clean_text(text)
    communicate = edge_tts.Communicate(cleaned, voice)
    await communicate.save(path)


def generate_audio_file(text: str, path: str, voice: str) -> None:
    """
    Generates TTS audio only if the file does not already exist.
    Hash-based paths mean same text+voice = same path = instant cache hit.
    Creates a new event loop per call (required for cross-thread usage).
    """
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return   # ✅ Cache hit — reuse existing audio

    os.makedirs(os.path.dirname(path), exist_ok=True)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_generate_async(text, path, voice))
    finally:
        loop.close()


# ─── OCR Text Correction for TTS ──────────────────────

def correct_ocr_for_tts(text: str, language: str = "Hindi") -> str:
    """
    Sends OCR-extracted text to Groq to fix broken words, spelling errors,
    and garbled characters before passing to edge-tts.
    Falls back to original text on any error.
    """
    if not text.strip():
        return text
    try:
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": (
                    f"Fix this OCR-extracted {language} text for Text-to-Speech.\n"
                    "Fix spelling mistakes, broken words, and garbled characters.\n"
                    "Return ONLY the corrected text, nothing else.\n\n"
                    f"OCR Text:\n{text[:1500]}"
                ),
            }],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"TTS correction error: {e}")
        return text
