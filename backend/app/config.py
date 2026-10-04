import os
import json
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "ChronoRx Tech"
    APP_ENV: str = "development"
    SECRET_KEY: str = "chronorx_super_secret_jwt_key_development_only_change_in_production_2025"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATABASE_URL: str = "sqlite:///./chronorx.db"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    AI_FALLBACK_MODE: bool = True

    TESSERACT_CMD: str = ""
    OCR_FALLBACK_MODE: bool = True

    RXNAV_BASE_URL: str = "https://rxnav.nlm.nih.gov/REST"
    OPENFDA_BASE_URL: str = "https://api.fda.gov/drug"

    UPLOAD_DIR: str = "./uploads"
    GENERATED_REPORTS_DIR: str = "./generated_reports"
    MAX_UPLOAD_SIZE_MB: int = 15

    CORS_ORIGINS: str = '["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:8000"]'

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except Exception:
            return ["*"]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.GENERATED_REPORTS_DIR, exist_ok=True)
