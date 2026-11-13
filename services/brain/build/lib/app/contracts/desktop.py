from typing import Literal

from pydantic import BaseModel, Field, model_validator


DesktopAction = Literal["open_file", "open_folder", "open_application", "notify"]


class DesktopPairRequest(BaseModel):
    device_name: str = Field(min_length=1, max_length=120)
    platform: Literal["windows", "macos", "linux"]
    app_version: str | None = Field(default=None, max_length=80)


class DesktopPairResponse(BaseModel):
    device_id: str
    device_token: str


class DesktopNotificationPayload(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(max_length=1_000)


class DesktopActionRequest(BaseModel):
    workspace_id: str = Field(min_length=36, max_length=36)
    device_id: str = Field(min_length=36, max_length=36)
    action_type: DesktopAction
    path: str | None = Field(default=None, min_length=1, max_length=8_192)
    notification: DesktopNotificationPayload | None = None
    reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def validate_payload(self):
        if self.action_type == "notify" and not self.notification:
            raise ValueError("notification payload is required")
        if self.action_type != "notify" and not self.path:
            raise ValueError("path is required")
        return self


class DesktopActionResponse(BaseModel):
    action_id: str
    status: Literal["awaiting_approval", "approved", "executing", "completed", "failed"]
    expires_at: str | None = None


class DesktopHeartbeat(BaseModel):
    platform: str = Field(max_length=32)
    hostname: str = Field(max_length=255)
    memory_mb: int = Field(ge=1, le=16_777_216)


class DesktopCompletion(BaseModel):
    ok: bool
    path: str | None = Field(default=None, max_length=8_192)
    reason: str | None = Field(default=None, max_length=1_000)


class DesktopModelDelta(BaseModel):
    text: str = Field(min_length=1, max_length=16_000)


class DesktopModelCompletion(BaseModel):
    ok: bool
    error_code: str | None = Field(default=None, max_length=120)
