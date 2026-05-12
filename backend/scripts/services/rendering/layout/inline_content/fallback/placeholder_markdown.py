from __future__ import annotations

import re

from services.rendering.layout.inline_content.core.markdown import build_markdown_from_direct_text
from services.rendering.layout.inline_content.core.markdown import looks_like_citation
from services.rendering.layout.inline_content.core.markdown import normalize_plain_citation
from services.rendering.layout.inline_content.fallback.latex_normalizer import normalize_formula_for_latex_math
from services.translation.payload.formula_protection import re_protect_restored_formulas


def formula_map_lookup(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def split_protected_text(protected_text: str) -> list[str]:
    token_re = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]])")
    return [part for part in token_re.split(protected_text or "") if part]


def build_markdown_from_parts(
    protected: str,
    formula_map: list[dict],
) -> str:
    if not formula_map:
        return build_markdown_from_direct_text(
            protected or "",
        )
    protected = re_protect_restored_formulas(protected or "", formula_map)
    parts = split_protected_text(protected)
    formula_lookup = formula_map_lookup(formula_map)
    chunks: list[str] = []

    for part in parts:
        if part in formula_lookup:
            formula_text = formula_lookup.get(part, part)
            if looks_like_citation(formula_text):
                chunks.append(normalize_plain_citation(formula_text))
                continue
            chunks.append(f"${normalize_formula_for_latex_math(formula_text)}$")
        else:
            text = re.sub(r"\s+", " ", (part or "").strip())
            if text:
                chunks.append(text)

    markdown = "".join(chunks).strip()
    return build_markdown_from_direct_text(markdown)
