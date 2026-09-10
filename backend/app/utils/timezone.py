"""Centralized Timezone Authority for EduQuizX.

All internal server timestamps and database storage MUST represent absolute UTC instants.
All user-facing representations (UI, emails, CSV, reports) MUST be formatted in Indian Standard Time (IST — Asia/Kolkata).
"""

from datetime import datetime, timezone
from typing import Optional, Union
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc

def now_utc() -> datetime:
    """Returns the current timezone-aware UTC datetime."""
    return datetime.now(UTC)

def now_ist() -> datetime:
    """Returns the current timezone-aware IST datetime."""
    return datetime.now(IST)

def to_utc_instant(dt: Optional[Union[datetime, str]]) -> Optional[datetime]:
    """
    Normalizes any datetime or ISO string to a timezone-aware UTC datetime instant.
    
    Safety rules:
    - If dt is already timezone-aware, converts to UTC.
    - If dt is a naive datetime (e.g. read from legacy SQLite DB where datetime.utcnow() was stored),
      it strictly interprets it as UTC (never adding +05:30).
    - If dt is an ISO string:
      - If it has timezone offset (Z, +HH:MM, -HH:MM), parses and normalizes to UTC.
      - If it lacks timezone offset, assumes UTC.
    """
    if dt is None:
        return None
        
    if isinstance(dt, str):
        val = dt.strip()
        if not val:
            return None
        # Handle trailing Z
        if val.endswith("Z"):
            val = val[:-1] + "+00:00"
        parsed = datetime.fromisoformat(val)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            return dt.astimezone(UTC)
        # Legacy DB records: naive timestamp is UTC
        return dt.replace(tzinfo=UTC)
        
    return None

def to_ist(dt: Optional[Union[datetime, str]]) -> Optional[datetime]:
    """
    Converts a UTC instant (aware or naive legacy DB) into a timezone-aware IST datetime.
    """
    utc_dt = to_utc_instant(dt)
    if utc_dt is None:
        return None
    return utc_dt.astimezone(IST)

def to_iso_utc(dt: Optional[Union[datetime, str]]) -> Optional[str]:
    """
    Converts a datetime into standard ISO-8601 UTC string format with trailing 'Z'.
    Example: '2026-09-10T04:30:00.000000Z' or '2026-09-10T04:30:00Z'.
    """
    utc_dt = to_utc_instant(dt)
    if utc_dt is None:
        return None
    iso = utc_dt.isoformat()
    if iso.endswith("+00:00"):
        iso = iso[:-6] + "Z"
    elif not iso.endswith("Z"):
        iso = iso + "Z"
    return iso

def format_ist(dt: Optional[Union[datetime, str]], fmt: str = "%d-%b-%Y %I:%M %p IST") -> str:
    """
    Formats a datetime instant in Asia/Kolkata (IST).
    Returns an empty string or fallback if None.
    """
    ist_dt = to_ist(dt)
    if ist_dt is None:
        return ""
    return ist_dt.strftime(fmt)

def format_ist_time(dt: Optional[Union[datetime, str]]) -> str:
    """Formats time only in IST, e.g. '10:00 AM IST'."""
    return format_ist(dt, fmt="%I:%M %p IST").lstrip("0")

def format_ist_date(dt: Optional[Union[datetime, str]]) -> str:
    """Formats date only in IST, e.g. '10 Sep 2026'."""
    return format_ist(dt, fmt="%d %b %Y")

def format_ist_datetime(dt: Optional[Union[datetime, str]]) -> str:
    """Formats full datetime in IST, e.g. '10 Sep 2026, 10:00 AM IST'."""
    ist_dt = to_ist(dt)
    if ist_dt is None:
        return ""
    date_str = ist_dt.strftime("%d %b %Y")
    time_str = ist_dt.strftime("%I:%M %p IST").lstrip("0")
    return f"{date_str}, {time_str}"
