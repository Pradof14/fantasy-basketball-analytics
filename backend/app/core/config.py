"""
Central application configuration.

We use pydantic-settings so every config value is validated and typed,
and so nothing sensitive (DB credentials, etc.) ever gets hardcoded.
All values are pulled from environment variables / a local .env file.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    database_url: str

    # App
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # CORS - comma separated origins, parsed into a list
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """
    Cached so we only parse env vars once per process, not on every request.
    Import this function (not Settings directly) wherever config is needed.
    """
    return Settings()
