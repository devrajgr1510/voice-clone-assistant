"""
Admin authentication service.

Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib `hashlib`, no extra
dependency needed) using a random per-user salt + 200k iterations. Sessions
are stateless JSON Web Tokens (PyJWT), signed with HS256 using SECRET_KEY.

For a real production deployment: move SECRET_KEY into an environment
variable / secrets manager (a default is provided here only so the app
works out of the box for local/demo use), put the app behind HTTPS, and
consider short-lived access tokens + refresh tokens instead of a single
long-lived JWT.
"""
import os
import hmac
import hashlib
import base64
import datetime as dt
from typing import Optional

import jwt

SECRET_KEY = os.environ.get("VAANEE_SECRET_KEY", "vaanee-shield-dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_TTL_HOURS = int(os.environ.get("VAANEE_TOKEN_TTL_HOURS", "12"))

PBKDF2_ITERATIONS = 200_000


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    """Returns 'salt_b64$hash_b64' — safe to store directly in the DB."""
    if salt is None:
        salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_b64, hash_b64 = stored.split("$", 1)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except (ValueError, TypeError):
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(candidate, expected)


def create_access_token(*, sub: str, role: str = "admin") -> str:
    now = dt.datetime.utcnow()
    payload = {
        "sub": sub,
        "role": role,
        "iat": now,
        "exp": now + dt.timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
