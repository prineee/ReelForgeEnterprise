#!/bin/bash
set -e

echo "[setup] Downloading Wav2Lip models..."

CHECKPOINT_DIR="/app/Wav2Lip/checkpoints"
FACE_DIR="/app/Wav2Lip/face_detection/detection/sfd"

mkdir -p "$CHECKPOINT_DIR"
mkdir -p "$FACE_DIR"

# Wav2Lip checkpoint
if [ ! -f "$CHECKPOINT_DIR/wav2lip.pth" ]; then
    echo "[setup] Downloading wav2lip.pth..."
    wget -q --show-progress \
        -O "$CHECKPOINT_DIR/wav2lip.pth" \
        "https://huggingface.co/numz/wav2lip_studio/resolve/main/Wav2Lip/wav2lip.pth"
    echo "[setup] wav2lip.pth downloaded"
else
    echo "[setup] wav2lip.pth already exists, skipping"
fi

# Face detection model
if [ ! -f "$FACE_DIR/s3fd.pth" ]; then
    echo "[setup] Downloading s3fd face detection model..."
    wget -q --show-progress \
        -O "$FACE_DIR/s3fd.pth" \
        "https://www.adrianbulat.com/downloads/python-fan/s3fd-619a316812.pth" \
    || wget -q --show-progress \
        -O "$FACE_DIR/s3fd.pth" \
        "https://huggingface.co/numz/wav2lip_studio/resolve/main/s3fd.pth"
    echo "[setup] s3fd.pth downloaded"
else
    echo "[setup] s3fd.pth already exists, skipping"
fi

echo "[setup] All models ready"
