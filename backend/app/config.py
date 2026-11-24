"""Small environment settings loader; keeps local startup dependency-light."""
from pathlib import Path
import os

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
if _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _key, _value = _line.split("=", 1)
        os.environ.setdefault(_key.strip(), _value.strip().strip('"').strip("'"))

class Settings:
    database_url = os.getenv("DATABASE_URL", "sqlite:///./careercompass.db")
    if database_url.startswith("postgres://"):
        database_url = "postgresql+psycopg://" + database_url[len("postgres://"):]
    elif database_url.startswith("postgresql://") and not database_url.startswith("postgresql+psycopg://"):
        database_url = "postgresql+psycopg://" + database_url[len("postgresql://"): ]
    secret_key = os.getenv("SECRET_KEY", "development-only-change-this-secret")
    access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    frontend_origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", frontend_origin).split(",") if origin.strip()]
    environment = os.getenv("ENVIRONMENT", "development").casefold()
    public_app_url = os.getenv("PUBLIC_APP_URL", frontend_origin).rstrip("/")
    public_api_url = os.getenv("PUBLIC_API_URL", "").rstrip("/") or "http://127.0.0.1:8000"
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", "CareerCompass AI <noreply@careercompass.local>")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").casefold() in {"1", "true", "yes"}
    google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")

settings = Settings()
if settings.environment == "production" and settings.secret_key == "development-only-change-this-secret":
    raise RuntimeError("Set a unique SECRET_KEY before starting in production.")
