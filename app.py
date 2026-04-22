import os
import sys

# ─── Windows asyncio fix (must run before any import that touches asyncio) ────
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from flask import Flask

from config.settings import UPLOAD_FOLDER, AUDIO_FOLDER
from routes.upload_routes import upload_bp
from routes.reader_routes import reader_bp
from routes.ocr_routes    import ocr_bp
from routes.tts_routes    import tts_bp
from routes.ai_routes     import ai_bp


def create_app() -> Flask:
    app = Flask(__name__)

    # Ensure storage directories exist at startup
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(AUDIO_FOLDER,  exist_ok=True)

    # Register all blueprints
    app.register_blueprint(upload_bp)
    app.register_blueprint(reader_bp)
    app.register_blueprint(ocr_bp)
    app.register_blueprint(tts_bp)
    app.register_blueprint(ai_bp)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
