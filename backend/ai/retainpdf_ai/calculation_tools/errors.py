"""Stable, input-safe errors for deterministic calculation tools."""

from __future__ import annotations

from typing import Any


class CalculationError(ValueError):
    """A calculation failure that is safe to expose to an API/tool caller.

    Messages are deliberately fixed by the implementation.  They never include
    the rejected expression, table content, or a nested exception message.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def to_payload(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
            }
        }


def fail(code: str, message: str) -> None:
    raise CalculationError(code, message)
