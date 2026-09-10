from __future__ import annotations

import re


UNESCAPED_INLINE_DOLLAR_RE = re.compile(r"(?<!\\)\$")


def has_balanced_inline_math_delimiters(text: str) -> bool:
    return len(UNESCAPED_INLINE_DOLLAR_RE.findall(text or "")) % 2 == 0


__all__ = ["UNESCAPED_INLINE_DOLLAR_RE", "has_balanced_inline_math_delimiters"]
