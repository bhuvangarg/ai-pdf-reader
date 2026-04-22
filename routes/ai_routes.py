from flask import Blueprint, jsonify, request

from groq import Groq

from config.settings import GROQ_API_KEY, GROQ_MODEL
from models.book_model import book_state
from services.rag_service import rag_service

ai_bp = Blueprint("ai", __name__)


def _client() -> Groq:
    return Groq(api_key=GROQ_API_KEY)


# ─── Book Introduction ─────────────────────────────────

@ai_bp.route("/introduction", methods=["POST"])
def introduction():
    if not book_state.pages_data:
        return jsonify({"error": "Pehle PDF upload karo"}), 400

    sample_text = " ".join(book_state.pages_data[:3])[:3000]

    response = _client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                "Based on this text from a book, give me:\n"
                "1. 📖 Book Title (guess if not obvious)\n"
                "2. 📝 Summary (2-3 lines)\n"
                "3. 🎯 What this book is about\n"
                "4. 💡 What the reader will learn\n\n"
                "Keep it short, friendly and engaging.\n\n"
                f"Book text:\n{sample_text}"
            ),
        }],
    )

    return jsonify({"introduction": response.choices[0].message.content})


# ─── Explain This ──────────────────────────────────────

@ai_bp.route("/explain", methods=["POST"])
def explain():
    data = request.get_json()
    selected_text = data.get("text", "").strip()

    if not selected_text:
        return jsonify({"error": "Koi text select nahi kiya!"}), 400

    response = _client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": (
                "Explain this text in very simple, easy-to-understand language.\n"
                "Like you're explaining to a curious student.\n"
                "Keep it concise — max 4-5 lines.\n\n"
                f"Text to explain:\n{selected_text}"
            ),
        }],
    )

    return jsonify({"explanation": response.choices[0].message.content})


# ─── Word Meaning ──────────────────────────────────────

@ai_bp.route("/meaning", methods=["POST"])
def meaning():
    data    = request.get_json()
    word    = data.get("word", "").strip()
    context = data.get("context", "").strip()

    if not word:
        return jsonify({"error": "Koi word nahi mila!"}), 400

    response = _client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": (
                f'Give me for the word "{word}":\n'
                "1. 📖 Simple meaning (1 line)\n"
                "2. 📝 Meaning in this context (1 line)\n"
                "3. 💡 Example sentence\n\n"
                f"Context where word was used:\n{context}\n\n"
                "Keep it very short and simple."
            ),
        }],
    )

    return jsonify({"meaning": response.choices[0].message.content})


# ─── Smart Notes ───────────────────────────────────────

_NOTE_PROMPTS = {
    "summary": (
        "Read this page and give a clear, concise summary in 3-4 lines.\n"
        "Focus on the main idea only.\n\nPage text:\n{text}"
    ),
    "bullets": (
        "Read this page and extract the most important points as bullet points.\n"
        "Give maximum 6 bullet points. Each point should be 1 line.\n"
        "Format: • point\n\nPage text:\n{text}"
    ),
    "revision": (
        "Create short revision notes from this page for a student.\n"
        "Include:\n"
        "1. 🎯 Main Topic\n"
        "2. 📌 Key Points (max 5)\n"
        "3. 🧠 Remember This (1 important line)\n\n"
        "Page text:\n{text}"
    ),
}


@ai_bp.route("/notes", methods=["POST"])
def notes():
    data     = request.get_json()
    page_num = data.get("page", 0)
    mode     = data.get("mode", "summary")

    if not book_state.pages_data:
        return jsonify({"error": "Pehle PDF upload karo"}), 400

    page_text = book_state.get_page_text(page_num)

    if not page_text.strip():
        return jsonify({"error": "Is page pe koi text nahi hai!"}), 400

    if mode not in _NOTE_PROMPTS:
        mode = "summary"

    prompt = _NOTE_PROMPTS[mode].format(text=page_text[:2000])

    response = _client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    return jsonify({"notes": response.choices[0].message.content, "mode": mode})


# ─── Chat with Book (context window) ──────────────────

@ai_bp.route("/chat", methods=["POST"])
def chat():
    data         = request.get_json()
    question     = data.get("question", "").strip()
    page_num     = data.get("page", 0)
    chat_history = data.get("history", [])

    if not question:
        return jsonify({"error": "Koi question nahi!"}), 400
    if not book_state.pages_data:
        return jsonify({"error": "Pehle PDF upload karo"}), 400

    start = max(0, page_num - 1)
    end   = min(len(book_state.pages_data), page_num + 2)
    context = " ".join(book_state.get_page_text(i) for i in range(start, end))[:3000]

    messages = [{
        "role": "system",
        "content": (
            "You are a helpful reading assistant.\n"
            "Answer questions based on the book content provided.\n"
            "If the answer is not in the context, say so honestly.\n"
            "Keep answers clear and concise.\n\n"
            f"Current book context (pages {start + 1}-{end}):\n{context}"
        ),
    }]
    messages.extend(chat_history[-6:])
    messages.append({"role": "user", "content": question})

    response = _client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=512,
        messages=messages,
    )

    return jsonify({"answer": response.choices[0].message.content})


# ─── Chat with Book (RAG) ──────────────────────────────

@ai_bp.route("/chat-rag", methods=["POST"])
def chat_rag():
    data         = request.get_json()
    question     = data.get("question", "").strip()
    chat_history = data.get("history", [])
    page         = data.get("page", 0)

    if not question:
        return jsonify({"error": "Koi question nahi!"}), 400
    if not book_state.pages_data:
        return jsonify({"error": "Pehle PDF upload karo"}), 400

    relevant_chunks = rag_service.search_chunks(question, top_k=4)
    context = " ".join(relevant_chunks)

    messages = [{
        "role": "system",
        "content": (
            "You are an intelligent AI reading assistant.\n"
            f"The user is currently reading page {page + 1} of a book.\n"
            "Use the conversation history and book context to give better answers.\n"
            'If the answer is not in the book context, say "Not found in book".\n'
            "Be clear, helpful, and conversational.\n\n"
            f"Book context:\n{context}"
        ),
    }]
    messages.extend(chat_history[-6:])
    messages.append({"role": "user", "content": question})

    response = _client().chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=512,
        messages=messages,
    )

    return jsonify({"answer": response.choices[0].message.content})
