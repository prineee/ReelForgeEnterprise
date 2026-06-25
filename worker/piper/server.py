#!/usr/bin/env python3
"""
Piper TTS HTTP server for ReelForge.
Usage: python3 server.py [--port 5000] [--models-dir ./models]
"""

import argparse
import io
import os
import glob
from pathlib import Path

from flask import Flask, jsonify, request, Response

app = Flask(__name__)

# Loaded voice model cache: { voice_name: PiperVoice }
_voice_cache: dict = {}
_models_dir: str = "./models"


def get_model_path(voice: str) -> str | None:
    """Find the .onnx file for a given voice name."""
    candidates = glob.glob(os.path.join(_models_dir, f"{voice}.onnx"))
    if candidates:
        return candidates[0]
    # Also try matching by prefix (e.g. en_US-amy-medium)
    for f in glob.glob(os.path.join(_models_dir, "*.onnx")):
        if Path(f).stem == voice:
            return f
    return None


def load_voice(voice: str):
    """Load (or return cached) a PiperVoice for the given name."""
    if voice in _voice_cache:
        return _voice_cache[voice]

    try:
        from piper import PiperVoice  # type: ignore
    except ImportError:
        raise RuntimeError("piper-tts package not installed. Run: pip install piper-tts")

    model_path = get_model_path(voice)
    if not model_path:
        raise FileNotFoundError(f"No .onnx model found for voice '{voice}' in {_models_dir}")

    config_path = model_path + ".json"
    pv = PiperVoice.load(model_path, config_path=config_path if os.path.exists(config_path) else None)
    _voice_cache[voice] = pv
    return pv


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/voices")
def voices():
    onnx_files = glob.glob(os.path.join(_models_dir, "*.onnx"))
    return jsonify([Path(f).stem for f in onnx_files])


@app.post("/synthesize")
def synthesize():
    body = request.get_json(force=True, silent=True) or {}
    text  = body.get("text", "").strip()
    voice = body.get("voice", "en_US-amy-medium")

    if not text:
        return jsonify({"error": "text is required"}), 400

    try:
        pv = load_voice(voice)
    except (RuntimeError, FileNotFoundError) as e:
        return jsonify({"error": str(e)}), 500

    buf = io.BytesIO()
    import wave
    with wave.open(buf, "wb") as wav_file:
        pv.synthesize(text, wav_file)

    buf.seek(0)
    return Response(buf.read(), mimetype="audio/wav")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port",       type=int, default=int(os.getenv("PORT", 5000)))
    parser.add_argument("--models-dir", type=str, default=os.getenv("PIPER_MODELS_DIR", "./models"))
    args = parser.parse_args()

    _models_dir = args.models_dir
    print(f"Piper TTS server starting on port {args.port}, models: {_models_dir}")
    app.run(host="0.0.0.0", port=args.port)
