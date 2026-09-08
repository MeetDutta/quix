import time
import re
import hashlib
import threading
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Request, HTTPException

class BaseRateLimiter(ABC):
    """
    Abstract Base Class for Rate Limiting.
    Allows swappable backends (e.g. InMemoryRateLimiter for single instance,
    RedisRateLimiter for multi-instance distributed deployments) without
    changing any route dependencies or business logic.
    """
    @abstractmethod
    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60) -> None:
        """Enforces rate limit on the given key or raises HTTPException(429)."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Resets rate limiting state (used for testing or maintenance)."""
        pass

class InMemoryRateLimiter(BaseRateLimiter):
    """
    Thread-safe sliding window rate limiter for protecting security-critical endpoints.
    
    LIMITATION NOTE (SINGLE-INSTANCE):
    This implementation stores sliding-window timestamps in local process memory.
    It is fully thread-safe and zero-dependency for single-instance Render deployments.
    If the application is horizontally scaled to multiple Render service instances,
    a RedisRateLimiter implementing BaseRateLimiter should be substituted so that
    rate limits are shared globally across nodes.
    """
    def __init__(self):
        self._requests: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60) -> None:
        now = time.time()
        with self._lock:
            timestamps = self._requests[key]
            # Prune timestamps outside the active window
            cutoff = now - window_seconds
            self._requests[key] = [t for t in timestamps if t > cutoff]
            
            if len(self._requests[key]) >= max_requests:
                retry_after = int(window_seconds - (now - self._requests[key][0]))
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Please slow down and try again in {max(retry_after, 1)} seconds.",
                    headers={"Retry-After": str(max(retry_after, 1))}
                )
            
            self._requests[key].append(now)

    def reset(self) -> None:
        """Clears all rate limiting buckets (useful for test resets)."""
        with self._lock:
            self._requests.clear()

# Active rate limiter instance
limiter: BaseRateLimiter = InMemoryRateLimiter()

_IP_REGEX = re.compile(r"^[0-9a-fA-F:.]+$")

def extract_client_key(request: Request) -> str:
    """
    Safely extracts client identifier for rate limiting.
    Prevents key bypass through malformed, empty, or spoofed headers.
    """
    ip = None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Leftmost entry represents original client
        candidate = forwarded.split(",")[0].strip()
        if candidate and _IP_REGEX.match(candidate):
            ip = candidate

    if not ip:
        if request.client and request.client.host:
            candidate = request.client.host.strip()
            if candidate and _IP_REGEX.match(candidate):
                ip = candidate

    # Fallback to fingerprinting if IP is unresolvable or malformed
    if not ip:
        ua = request.headers.get("User-Agent", "unknown_ua")
        lang = request.headers.get("Accept-Language", "unknown_lang")
        fp = hashlib.sha256(f"{ua}:{lang}".encode()).hexdigest()[:16]
        ip = f"fingerprint_{fp}"

    return f"{ip}:{request.url.path}"

def rate_limit_dependency(max_requests: int = 10, window_seconds: int = 60):
    """FastAPI dependency for rate limiting by client key."""
    def _rate_limiter(request: Request):
        endpoint_key = extract_client_key(request)
        limiter.check_rate_limit(endpoint_key, max_requests=max_requests, window_seconds=window_seconds)
    return _rate_limiter
