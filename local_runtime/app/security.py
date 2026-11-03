from __future__ import annotations

import hmac
import secrets
import time
from dataclasses import dataclass


@dataclass
class Session:
    token: str
    expires_at: float


class PairingManager:
    def __init__(self, code: str, *, code_ttl_seconds: int = 600, session_ttl_seconds: int = 43_200):
        self._code = code
        self._code_expires_at = time.monotonic() + code_ttl_seconds
        self._session_ttl_seconds = session_ttl_seconds
        self._attempts = 0
        self._session: Session | None = None

    def exchange(self, candidate: str) -> Session | None:
        if self._attempts >= 5 or time.monotonic() >= self._code_expires_at:
            return None
        self._attempts += 1
        if not hmac.compare_digest(candidate, self._code):
            return None
        self._code = ""
        token = secrets.token_urlsafe(32)
        self._session = Session(token=token, expires_at=time.monotonic() + self._session_ttl_seconds)
        return self._session

    def rotate_code(self) -> str:
        self._code = secrets.token_urlsafe(9)
        self._code_expires_at = time.monotonic() + 600
        self._attempts = 0
        return self._code

    def is_authorized(self, token: str) -> bool:
        session = self._session
        if session is None or time.monotonic() >= session.expires_at:
            self._session = None
            return False
        return hmac.compare_digest(token, session.token)
