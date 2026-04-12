import re

from services.rendering.formula.normalizer import normalize_formula_for_latex_math
from services.translation.payload.formula_protection import re_protect_restored_formulas


def formula_map_lookup(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def split_protected_text(protected_text: str) -> list[str]:
    token_re = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]])")
    return [part for part in token_re.split(protected_text or "") if part]


BRACKET_CITATION_RE = re.compile(r"^\[\s*(?P<body>\d+[A-Za-z]?(?:\s*[-,]\s*\d+[A-Za-z]?)*?)\s*\]$")
SUPERSCRIPT_CITATION_RE = re.compile(r"^\^\{\s*(?P<body>\d+[A-Za-z]?(?:\s*[-,]\s*\d+[A-Za-z]?)*?)\s*\}$")
SUPERSCRIPT_CHAR_MAP = str.maketrans(
    {
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹",
        "-": "⁻",
        "a": "ᵃ",
        "b": "ᵇ",
        "c": "ᶜ",
        "d": "ᵈ",
        "e": "ᵉ",
        "f": "ᶠ",
        "g": "ᵍ",
        "h": "ʰ",
        "i": "ⁱ",
        "j": "ʲ",
        "k": "ᵏ",
        "l": "ˡ",
        "m": "ᵐ",
        "n": "ⁿ",
        "o": "ᵒ",
        "p": "ᵖ",
        "r": "ʳ",
        "s": "ˢ",
        "t": "ᵗ",
        "u": "ᵘ",
        "v": "ᵛ",
        "w": "ʷ",
        "x": "ˣ",
        "y": "ʸ",
        "z": "ᶻ",
    }
)


def _compact_citation_body(body: str) -> str:
    text = re.sub(r"\s+", "", body or "")
    text = re.sub(r"\s*([,-])\s*", r"\1", text)
    return text


def looks_like_citation(formula_text: str) -> bool:
    expr = " ".join(formula_text.strip().split())
    return bool(BRACKET_CITATION_RE.fullmatch(expr) or SUPERSCRIPT_CITATION_RE.fullmatch(expr))


def normalize_plain_citation(formula_text: str) -> str:
    expr = " ".join(formula_text.strip().split())
    bracket_match = BRACKET_CITATION_RE.fullmatch(expr)
    if bracket_match is not None:
        return f"[{_compact_citation_body(bracket_match.group('body'))}]"
    superscript_match = SUPERSCRIPT_CITATION_RE.fullmatch(expr)
    if superscript_match is not None:
        body = _compact_citation_body(superscript_match.group("body"))
        return body.translate(SUPERSCRIPT_CHAR_MAP)
    return formula_text.strip()


INLINE_MATH_BLOCK_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")


def _normalize_text_chunk(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _surround_inline_math_with_spaces(markdown: str) -> str:
    text = markdown or ""
    text = INLINE_MATH_BLOCK_RE.sub(lambda m: f" {m.group(0)} ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_markdown_paragraph(item: dict) -> str:
    protected = item.get("protected_translated_text") or item.get("protected_source_text", "")
    return build_markdown_from_parts(protected, item.get("formula_map", []))


def build_markdown_from_parts(protected: str, formula_map: list[dict]) -> str:
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
            text = _normalize_text_chunk(part)
            if text:
                chunks.append(text)

    markdown = "".join(chunks).strip()
    markdown = _surround_inline_math_with_spaces(markdown)
    markdown = re.sub(
        r"\\textcircled\s*\{\s*\\scriptsize\s*\{\s*\\parallel\s*\}\s*\}",
        r"$\\circ$",
        markdown,
    )
    markdown = re.sub(r"\\textcircled\s*\{\s*\\parallel\s*\}", r"$\\circ$", markdown)
    markdown = re.sub(r"\\textcircled\s*\{\s*\\times\s*\}", r"$\\otimes$", markdown)
    return markdown


def build_plain_text(item: dict) -> str:
    text = (item.get("translated_text") or item.get("source_text") or "").strip()
    return build_plain_text_from_text(text)


def build_plain_text_from_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())
