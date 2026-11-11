from typing import Literal

from pydantic import BaseModel, Field


class ChatStreamRequest(BaseModel):
    workspace_id: str = Field(min_length=36, max_length=36)
    conversation_id: str | None = Field(default=None, min_length=36, max_length=36)
    message: str = Field(min_length=1, max_length=24_000)
    model: str = "qwen2.5:7b"


class StreamEvent(BaseModel):
    version: Literal["v1"] = "v1"
    type: Literal["metadata", "status", "delta", "approval", "tool", "error", "done"]
    run_id: str
    sequence: int = Field(ge=1)
    correlation_id: str
    payload: dict = Field(default_factory=dict)
