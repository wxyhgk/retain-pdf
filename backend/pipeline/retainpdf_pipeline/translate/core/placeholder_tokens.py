"""Pure placeholder syntax shared by policy, formula protection and LLM validation."""
from __future__ import annotations

import re


PROTECTED_TOKEN_RE = re.compile(
    r"<[futnvc]\d+-[0-9a-z]{3}/>"
    r"|\[\[FORMULA_\d+]]"
    r"|@@F\d+@@"
)
FORMAL_PLACEHOLDER_RE = re.compile(r"<f\d+-[0-9a-z]{3}/>|<t\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")
ALIAS_PLACEHOLDER_RE = re.compile(r"@@P\d+@@")
PLACEHOLDER_RE = re.compile(rf"{PROTECTED_TOKEN_RE.pattern}|@@P\d+@@")
FORMULA_TOKEN_RE = re.compile(r"<f\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|@@P\d+@@")


def strip_placeholders(text: str) -> str:
    return PLACEHOLDER_RE.sub(" ", text or "")


def placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(text or ""))


def placeholder_sequence(text: str) -> list[str]:
    return PLACEHOLDER_RE.findall(text or "")


__all__ = [
    "PROTECTED_TOKEN_RE", "ALIAS_PLACEHOLDER_RE", "FORMAL_PLACEHOLDER_RE",
    "FORMULA_TOKEN_RE", "PLACEHOLDER_RE", "placeholder_sequence",
    "placeholders", "strip_placeholders",
]
