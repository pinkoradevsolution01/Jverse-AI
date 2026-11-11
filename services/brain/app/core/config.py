from functools import lru_cache

from pydantic import AliasChoices, AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    supabase_url: AnyHttpUrl = Field(validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"))
    supabase_publishable_key: SecretStr = Field(validation_alias=AliasChoices("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
    supabase_service_role_key: SecretStr = Field(validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY"))
    control_plane_token: SecretStr = Field(validation_alias=AliasChoices("CONTROL_PLANE_TOKEN", "AI_CONTROL_PLANE_TOKEN"))
    compat_local_ollama: bool = False
    ollama_url: AnyHttpUrl = "http://127.0.0.1:11434"
    allowed_model: str = "qwen2.5:7b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
