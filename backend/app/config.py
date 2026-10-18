from functools import lru_cache
from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    # Application
    APP_ENV: str = "production"
    APP_NAME: str = "CRM Ultra"
    DEBUG: bool = False
    
    # URLs & Networking
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000/api"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/app.db"
    
    # Authentication & Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15
    PASSWORD_MIN_LENGTH: int = 8
    SESSION_INACTIVITY_MINUTES: int = 30
    TRUSTED_PROXY_IPS: str = "172.16.0.0/12,10.0.0.0/8,127.0.0.1"
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = ""
    
    # Crawler Limits & Performance (Tuned for 8GB Hostinger VPS)
    MAX_PAGES: int = 20
    CRAWL_DELAY: float = 1.0  # seconds between page requests
    MAX_CONCURRENT_SCANS: int = 2
    REQUEST_TIMEOUT: int = 15000  # milliseconds
    MAX_PAGE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB max per page
    USER_AGENT: str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; CRMUltraBot/1.0; +https://github.com)"
    
    # Queue / Broker
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: str = ""
    USE_IN_MEMORY_QUEUE_FALLBACK: bool = True
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    EXPORTS_DIR: Path = BASE_DIR / "exports"
    LOGS_DIR: Path = BASE_DIR / "logs"

    # Hostinger Agentic Mail Integration
    HOSTINGER_MAIL_API_URL: str = "https://api.mail.hostinger.com"
    HOSTINGER_MAIL_API_TOKEN: str = ""
    HOSTINGER_MAIL_RESOURCE_ID: str = ""
    HOSTINGER_MAIL_FROM_EMAIL: str = "hello@sakibhossain.io"
    HOSTINGER_MAIL_DISPLAY_NAME: str = "Sakib Hossain"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    # Ensure directories exist
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    settings.LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
