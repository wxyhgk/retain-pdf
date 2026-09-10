"""Private validation and bounded-output helpers."""

from __future__ import annotations

import json
import math
import unicodedata
from collections.abc import Sequence
from typing import Any, TypeAlias

from .errors import fail
from .limits import MAX_ABS_INPUT_NUMBER, MAX_PAYLOAD_BYTES

Number: TypeAlias = int | float


def require_number(value: object) -> Number:
    """Accept only ordinary finite JSON number types, never bool/subclasses."""
    if type(value) not in (int, float):
        fail("invalid_number", "Values must be finite numbers.")
    if isinstance(value, float) and not math.isfinite(value):
        fail("invalid_number", "Values must be finite numbers.")
    if abs(value) > MAX_ABS_INPUT_NUMBER:
        fail("numeric_limit_exceeded", "A numeric value exceeds the safe limit.")
    if isinstance(value, float) and value == 0:
        return 0.0
    return value


def require_sequence(value: object, *, what: str) -> Sequence[object]:
    if isinstance(value, (str, bytes, bytearray)) or not isinstance(value, Sequence):
        fail("invalid_input", f"{what} must be an array.")
    return value


def require_text(value: object, *, what: str, max_chars: int) -> str:
    if type(value) is not str:
        fail("invalid_text", f"{what} must be text.")
    if len(value) > max_chars:
        fail("text_limit_exceeded", f"{what} exceeds the text limit.")
    if any(
        unicodedata.category(character) in {"Cc", "Cs"}
        or (ord(character) & 0xFFFF) in {0xFFFE, 0xFFFF}
        for character in value
    ):
        fail("invalid_text", f"{what} contains unsupported control characters.")
    return value


def bounded_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Reject unexpectedly large serialized output before returning it."""
    try:
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, OverflowError):
        fail("invalid_result", "The calculation produced an invalid result.")
    if len(encoded) > MAX_PAYLOAD_BYTES:
        fail("output_limit_exceeded", "The calculation output exceeds the safe limit.")
    return payload
