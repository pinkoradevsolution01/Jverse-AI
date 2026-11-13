from __future__ import annotations

import asyncio
import os
import tempfile
import sys
import shutil
from pathlib import Path

from app.core.config import Settings

WAKE_WORD = "hey jverse"


class VoiceUnavailableError(RuntimeError):
    pass


class VoiceService:
    """Open-source STT/TTS boundary. Models are loaded lazily, never in the browser."""

    _whisper_model = None

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _whisper(self):
        if self._whisper_model is None:
            try:
                from faster_whisper import WhisperModel
                self.__class__._whisper_model = WhisperModel(self.settings.whisper_model, device=self.settings.whisper_device, compute_type=self.settings.whisper_compute_type)
            except Exception as error:
                raise VoiceUnavailableError("Faster-Whisper is not installed or its model could not be loaded.") from error
        return self._whisper_model

    async def transcribe(self, audio: bytes, suffix: str) -> str:
        if not audio:
            raise ValueError("An audio recording is required.")
        if len(audio) > 16 * 1024 * 1024:
            raise ValueError("Voice recordings must be 16 MB or smaller.")
        descriptor, source = tempfile.mkstemp(prefix="jverse-voice-", suffix=suffix if suffix.startswith(".") else ".webm")
        os.close(descriptor)
        try:
            await asyncio.to_thread(Path(source).write_bytes, audio)

            def run() -> str:
                segments, _info = self._whisper().transcribe(source, vad_filter=True, beam_size=3)
                return " ".join(segment.text.strip() for segment in segments).strip()

            return await asyncio.to_thread(run)
        finally:
            Path(source).unlink(missing_ok=True)

    @staticmethod
    def wake_word(transcript: str) -> tuple[bool, str | None]:
        normalized = " ".join(transcript.casefold().split())
        if not normalized.startswith(WAKE_WORD):
            return False, None
        command = transcript[len(transcript) - len(transcript.lstrip()):].strip()
        # Remove the matched prefix while retaining the original user phrasing.
        command = transcript.strip()[len(WAKE_WORD):].lstrip(" ,.:!-" )
        return True, command or None

    async def synthesize(self, text: str) -> bytes:
        piper_executable = Path(sys.executable).parent / ("piper.exe" if sys.platform == "win32" else "piper")
        executable = self.settings.piper_executable or shutil.which("piper") or str(piper_executable)
        bundled_model = Path(__file__).resolve().parents[2] / "models" / "en_US-ryan-high.onnx"
        model = self.settings.piper_model_path or (str(bundled_model) if bundled_model.is_file() else None)
        if not model:
            raise VoiceUnavailableError("Piper is not configured on this JVerse Agent host.")
        if not Path(executable).is_file() or not Path(model).is_file():
            raise VoiceUnavailableError("Piper executable or voice model was not found.")
        descriptor, output = tempfile.mkstemp(prefix="jverse-piper-", suffix=".wav")
        os.close(descriptor)
        try:
            process = await asyncio.create_subprocess_exec(executable, "--model", model, "--output_file", output, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
            _stdout, stderr = await process.communicate(text.encode("utf-8"))
            if process.returncode != 0:
                raise VoiceUnavailableError(f"Piper failed: {stderr.decode('utf-8', errors='replace')[:300]}")
            return await asyncio.to_thread(Path(output).read_bytes)
        finally:
            Path(output).unlink(missing_ok=True)
