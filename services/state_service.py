import json
import os
import threading

from config.settings import STATE_FILE

_state_lock = threading.Lock()


def save_state(data: dict) -> None:
    """Persists last-opened book state to disk (thread-safe)."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with _state_lock:
        try:
            existing = _load_raw()
            existing.update(data)
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False)
        except Exception as e:
            print(f"State save error: {e}")


def load_state() -> dict:
    """Returns persisted state dict, or {} if none."""
    return _load_raw()


def _load_raw() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}
