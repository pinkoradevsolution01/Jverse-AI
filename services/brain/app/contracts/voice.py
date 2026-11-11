from pydantic import BaseModel, Field


class VoiceTranscription(BaseModel):
    transcript: str
    wake_word_detected: bool
    command: str | None = None


class VoiceSynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12_000)
