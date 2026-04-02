import re

from services.rendering.formula.normalizer import normalize_formula_for_latex_math


def formula_map_lookup(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def split_protected_text(protected_text: str) -> list[str]:
    parts: list[str] = []
    cursor = 0
    while cursor < len(protected_text):
        start = protected_text.find("[[FORMULA_", cursor)
        if start == -1:
            parts.append(protected_text[cursor:])
            break
        if start > cursor:
            parts.append(protected_text[cursor:start])
        end = protected_text.find("]]", start)
        if end == -1:
            parts.append(protected_text[start:])
            break
        parts.append(protected_text[start : end + 2])
        cursor = end + 2
    return [part for part in parts if part]


def looks_like_citation(formula_text: str) -> bool:
    expr = " ".join(formula_text.strip().split())
    return bool(re.fullmatch(r"\[\s*\d+(?:\s*[-,]\s*\d+)*\s*\]", expr))


def normalize_plain_citation(formula_text: str) -> str:
    digits = re.findall(r"\d+", formula_text)
    return f"[{','.join(digits)}]" if digits else formula_text.strip()


def build_markdown_paragraph(item: dict) -> str:
    protected = item.get("protected_translated_text") or item.get("protected_source_text", "")
    return build_markdown_from_parts(protected, item.get("formula_map", []))


def build_markdown_from_parts(protected: str, formula_map: list[dict]) -> str:
    parts = split_protected_text(protected)
    formula_lookup = formula_map_lookup(formula_map)
    chunks: list[str] = []

    for part in parts:
        if part.startswith("[[FORMULA_"):
            formula_text = formula_lookup.get(part, part)
            if looks_like_citation(formula_text):
                chunks.append(normalize_plain_citation(formula_text))
                continue
            chunks.append(f"${normalize_formula_for_latex_math(formula_text)}$")
        else:
            text = part.strip()
            if text:
                chunks.append(text)

    markdown = "".join(chunks).strip()
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
