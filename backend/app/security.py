"""Dependency-light password hashing and HS256 JWT helpers."""
from datetime import datetime, timedelta, timezone
import base64, hashlib, hmac, json, secrets
from .config import settings

_ITERATIONS = 310_000

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${_b64(salt)}${_b64(digest)}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        if hashed.startswith("pbkdf2_sha256$"):
            _, rounds, salt, expected = hashed.split("$", 3)
            actual = _b64(hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), _unb64(salt), int(rounds)))
            return hmac.compare_digest(actual, expected)
        # Compatibility for accounts created by an earlier bcrypt-based prototype.
        if hashed.startswith(("$2a$", "$2b$", "$2y$")):
            try:
                import bcrypt
                return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
            except (ImportError, ValueError):
                return False
    except (ValueError, TypeError, OverflowError):
        return False
    return False

def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    header = {"alg":"HS256", "typ":"JWT"}
    payload = {"sub":subject,"iat":int(now.timestamp()),"exp":int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp())}
    unsigned = _b64(json.dumps(header,separators=(",",":"),sort_keys=True).encode()) + "." + _b64(json.dumps(payload,separators=(",",":"),sort_keys=True).encode())
    signature = hmac.new(settings.secret_key.encode(), unsigned.encode(), hashlib.sha256).digest()
    return unsigned + "." + _b64(signature)

def create_purpose_token(subject: str, purpose: str, expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    header = {"alg":"HS256", "typ":"JWT"}
    payload = {
        "sub": subject,
        "purpose": purpose,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    unsigned = _b64(json.dumps(header, separators=(",", ":"), sort_keys=True).encode()) + "." + _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signature = hmac.new(settings.secret_key.encode(), unsigned.encode(), hashlib.sha256).digest()
    return unsigned + "." + _b64(signature)

def purpose_token_subject(token: str, purpose: str) -> str | None:
    try:
        header_part, payload_part, signature_part = token.split(".", 2)
        unsigned = header_part + "." + payload_part
        expected = _b64(hmac.new(settings.secret_key.encode(), unsigned.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature_part):
            return None
        header = json.loads(_unb64(header_part))
        payload = json.loads(_unb64(payload_part))
        if header.get("alg") != "HS256":
            return None
        if payload.get("purpose") != purpose:
            return None
        if int(payload.get("exp", 0)) <= int(datetime.now(timezone.utc).timestamp()):
            return None
        subject = payload.get("sub")
        return subject if isinstance(subject, str) else None
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None

def token_subject(token: str) -> str | None:
    try:
        header_part, payload_part, signature_part = token.split(".", 2)
        unsigned = header_part + "." + payload_part
        expected = _b64(hmac.new(settings.secret_key.encode(), unsigned.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature_part): return None
        header = json.loads(_unb64(header_part)); payload = json.loads(_unb64(payload_part))
        if header.get("alg") != "HS256": return None
        if int(payload.get("exp", 0)) <= int(datetime.now(timezone.utc).timestamp()): return None
        subject = payload.get("sub")
        return subject if isinstance(subject, str) else None
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None
