import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise RuntimeError(f"No encontré GOOGLE_API_KEY en {ENV_PATH}")

client = genai.Client(api_key=API_KEY)

def gemini_reply(text: str) -> str:
    resp = client.models.generate_content(
        model="gemini-2.5-flash",   # o "gemini-1.5-flash" si no tienes 2.5
        contents=text
    )
    # La forma simple:
    if resp.text:
        return resp.text

    # Fallback por si no viene text (raro, pero seguro):
    if getattr(resp, "candidates", None):
        parts = []
        for cand in resp.candidates:
            for part in getattr(cand.content, "parts", []):
                if hasattr(part, "text") and part.text:
                    parts.append(part.text)
        if parts:
            return "\n".join(parts)

    return "[Gemini] No hubo texto en la respuesta."
