from __future__ import annotations

import asyncio
import os
import re
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
                # A lightweight vocabulary hint substantially improves short
                # spoken destination commands without changing the model or
                # slowing normal conversation transcription.
                segments, _info = self._whisper().transcribe(
                    source,
                    vad_filter=True,
                    beam_size=3,
                    initial_prompt=(
                        "JVerse AI map command. Place names may include Manila, Makati, "
                        "BGC, Bonifacio Global City, Taguig, Quezon City, Pasig, Ortigas, "
                        "Alabang, Baguio, Cebu, Davao, Tokyo, Osaka, and Philippines."
                    ),
                )
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
        # Always prefer the Piper installed in JVerse's private virtual
        # environment. A global `piper` on PATH can point to a different
        # Python package/version and was causing desktop speech failures.
        executable = self.settings.piper_executable or (str(piper_executable) if piper_executable.is_file() else shutil.which("piper"))
        bundled_model = Path(__file__).resolve().parents[2] / "models" / "en_US-ryan-high.onnx"
        model = self.settings.piper_model_path or (str(bundled_model) if bundled_model.is_file() else None)
        if not model:
            raise VoiceUnavailableError("Piper is not configured on this JVerse Agent host.")
        model_path = Path(model)
        config_path = Path(f"{model}.json")
        if not executable or not Path(executable).is_file() or not model_path.is_file() or not config_path.is_file():
            raise VoiceUnavailableError("Piper executable or voice model was not found.")
        # Piper is happiest with natural, line-sized sentences. Remove visual
        # Markdown before speech while preserving English, Filipino, and
        # Taglish wording in the assistant response.
        spoken_text = re.sub(r"```[\s\S]*?```", " Code omitted. ", text)
        spoken_text = re.sub(r"[`*_>#]+", " ", spoken_text)
        spoken_text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", spoken_text)
        spoken_text = re.sub(r"[\t\r ]+", " ", spoken_text).strip()
        spoken_text = re.sub(r"(?<=[.!?])\s+", "\n", spoken_text)[:6_000]
        if not spoken_text:
            raise VoiceUnavailableError("There is no readable assistant response to speak.")
        descriptor, output = tempfile.mkstemp(prefix="jverse-piper-", suffix=".wav")
        os.close(descriptor)
        try:
            process = await asyncio.create_subprocess_exec(executable, "--model", str(model_path), "--config", str(config_path), "--output_file", output, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
            _stdout, stderr = await process.communicate(spoken_text.encode("utf-8"))
            if process.returncode != 0:
                raise VoiceUnavailableError("JVerse voice could not synthesize this response. Try again or use the browser voice fallback.")
            return await asyncio.to_thread(Path(output).read_bytes)
        finally:
            Path(output).unlink(missing_ok=True)
