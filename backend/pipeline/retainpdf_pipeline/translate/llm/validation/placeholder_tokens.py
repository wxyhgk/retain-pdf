"""Compatibility exports; placeholder syntax is owned by core."""
from retainpdf_pipeline.translate.core.placeholder_tokens import (
    ALIAS_PLACEHOLDER_RE,
    FORMAL_PLACEHOLDER_RE,
    FORMULA_TOKEN_RE,
    PLACEHOLDER_RE,
    PROTECTED_TOKEN_RE,
    placeholder_sequence,
    placeholders,
    strip_placeholders,
)


__all__ = [
    "ALIAS_PLACEHOLDER_RE",
    "FORMAL_PLACEHOLDER_RE",
    "FORMULA_TOKEN_RE",
    "PLACEHOLDER_RE",
    "placeholder_sequence",
    "placeholders",
    "strip_placeholders",
]
