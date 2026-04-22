from flask import Blueprint, jsonify, request, send_file

from models.book_model import book_state
from services.tts_service import (
    correct_ocr_for_tts,
    generate_audio_file,
    get_explanation_audio_path,
    get_page_audio_path,
    get_selected_audio_path,
)

tts_bp = Blueprint("tts", __name__)


@tts_bp.route("/speak/<int:num>")
def speak(num):
    if not (0 <= num < len(book_state.pages_data)):
        return jsonify({"error": "Page not found"}), 404

    voice = request.args.get("voice", "en-US-JennyNeural")
    lang  = request.args.get("lang",  "English")
    raw_text = book_state.get_page_text(num)

    # Apply Groq OCR correction for Hindi TTS
    if lang == "Hindi" or "hi-" in voice:
        text = correct_ocr_for_tts(raw_text, "Hindi")
    else:
        text = raw_text

    audio_path = get_page_audio_path(num, voice)

    try:
        generate_audio_file(text, audio_path, voice)
    except Exception as e:
        print(f"Audio generation error: {e}")
        return jsonify({"error": str(e)}), 500

    return send_file(audio_path, mimetype="audio/mpeg")


@tts_bp.route("/speak-text", methods=["POST"])
def speak_text():
    data  = request.get_json()
    text  = data.get("text", "").strip()
    voice = data.get("voice", "en-US-JennyNeural")

    if not text:
        return jsonify({"error": "Koi text nahi!"}), 400

    audio_path = get_selected_audio_path(text, voice)

    try:
        generate_audio_file(text, audio_path, voice)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return send_file(audio_path, mimetype="audio/mpeg")


@tts_bp.route("/explain-voice", methods=["POST"])
def explain_voice():
    data  = request.get_json()
    text  = data.get("text", "").strip()
    voice = data.get("voice", "en-US-JennyNeural")

    if not text:
        return jsonify({"error": "Koi explanation nahi hai!"}), 400

    audio_path = get_explanation_audio_path()

    try:
        generate_audio_file(text, audio_path, voice)
    except Exception as e:
        print(f"Explanation audio error: {e}")
        return jsonify({"error": str(e)}), 500

    return send_file(audio_path, mimetype="audio/mpeg")
