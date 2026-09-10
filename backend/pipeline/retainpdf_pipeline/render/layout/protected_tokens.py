"""Render-local protected-token facade (intra-render only).

Stage boundary note: rendering previously reached into
``retainpdf_pipeline.translate.public`` for these helpers. They are now
duplicated under
:mod:`retainpdf_pipeline.render.layout.text_analysis.protected_formula_tokens`
so render never imports translate at runtime.
"""

from __future__ import annotations

from typing import Pattern

from retainpdf_pipeline.render.layout.text_analysis.protected_formula_tokens import PROTECTED_TOKEN_RE
from retainpdf_pipeline.render.layout.text_analysis.protected_formula_tokens import protected_map_from_formula_map
from retainpdf_pipeline.render.layout.text_analysis.protected_formula_tokens import re_protect_restored_formulas
from retainpdf_pipeline.render.layout.text_analysis.protected_formula_tokens import restore_protected_tokens


def protected_token_re() -> Pattern[str]:
    return PROTECTED_TOKEN_RE


__all__ = [
    "protected_map_from_formula_map",
    "protected_token_re",
    "re_protect_restored_formulas",
    "restore_protected_tokens",
]
