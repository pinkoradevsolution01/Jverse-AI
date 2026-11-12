FROM python:3.12-slim

WORKDIR /app

COPY services/brain/pyproject.toml ./pyproject.toml
COPY services/brain/app ./app

# Faster-Whisper, Piper, and a compact open-source English Piper voice are
# packaged in the agent image. Secrets are provided only at runtime.
RUN pip install --no-cache-dir . \
    && mkdir -p /app/models \
    && python -m piper.download_voices --download-dir /app/models en_US-lessac-medium \
    && python -c "from faster_whisper import WhisperModel; WhisperModel('base.en', device='cpu', compute_type='int8')"

ENV PIPER_MODEL_PATH=/app/models/en_US-lessac-medium.onnx
ENV WHISPER_MODEL=base.en
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE_TYPE=int8

EXPOSE 10000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
