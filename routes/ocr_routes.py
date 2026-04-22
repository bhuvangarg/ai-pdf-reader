from flask import Blueprint, jsonify

from groq import Groq

from config.settings import GROQ_API_KEY, GROQ_MODEL
from models.book_model import book_state

ocr_bp = Blueprint("ocr", __name__)


@ocr_bp.route("/detect-language", methods=["POST"])
def detect_language():
    if not book_state.pages_data:
        return jsonify({"error": "Pehle PDF upload karo"}), 400

    sample_text = " ".join(book_state.pages_data[:2])[:1000]
    client = Groq(api_key=GROQ_API_KEY)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": (
                "Detect the language of this text.\n"
                "Reply with ONLY the language name in English.\n"
                "Examples: Hindi, English, French, Spanish, German, Urdu, Bengali, Tamil\n\n"
                f"Text:\n{sample_text}"
            ),
        }],
    )

    return jsonify({"language": response.choices[0].message.content.strip()})
