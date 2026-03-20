import re


PLACEHOLDER_RE = re.compile(r"\[\[FORMULA_(\d+)]]")
PROSE_BOUNDARY_RE = re.compile(r"([}\]])([A-Za-z][a-z]{2,})")
LATEX_FORMULA_RE = re.compile(
    r"""
    (
        (?:
            \\[A-Za-z]+
            | [A-Za-z]
        )
        (?:
            \s*
            (?:
                _\s*\{[^{}]*\}
                | \^\s*\{[^{}]*\}
                | _\s*[A-Za-z0-9]
                | \^\s*[A-Za-z0-9]
                | \{[^{}]*\}
                | \([^()]*\)
                | \[[^\[\]]*\]
                | [=+\-−*/<>.,]
                | [A-Za-z0-9]
                | \\[A-Za-z]+
            )
        )+
    )
    """,
    re.VERBOSE,
)
GREEK_RUN_RE = re.compile(
    r"""
    (
        (?:\\[A-Za-z]+|[α-ωΑ-Ωωγβμφαζη∂])
        (?:
            \s*
            (?:
                _\s*\{[^{}]*\}
                | \^\s*\{[^{}]*\}
                | [A-Za-z0-9]
                | \\[A-Za-z]+
            )
        )*
    )
    """,
    re.VERBOSE,
)


def _prepare_text(text: str) -> str:
    return PROSE_BOUNDARY_RE.sub(r"\1 \2", text)


def _iter_formula_matches(text: str):
    for pattern in (LATEX_FORMULA_RE, GREEK_RUN_RE):
        for match in pattern.finditer(text):
            value = match.group(0).strip()
            if any(marker in value for marker in ("\\", "_", "^", "{", "}", "α", "β", "γ", "μ", "φ", "ζ", "η", "∂")):
                yield match.start(), match.end(), value


def protect_inline_formulas(text: str) -> tuple[str, list[dict]]:
    prepared = _prepare_text(text)
    raw_matches = sorted(_iter_formula_matches(prepared), key=lambda item: (item[0], -(item[1] - item[0])))

    selected: list[tuple[int, int, str]] = []
    cursor = 0
    for start, end, value in raw_matches:
        if end <= cursor:
            continue
        if start < cursor:
            continue
        selected.append((start, end, value))
        cursor = end

    formula_map: list[dict] = []
    chunks: list[str] = []
    cursor = 0
    for start, end, value in selected:
        chunks.append(prepared[cursor:start])
        placeholder = f"[[FORMULA_{len(formula_map) + 1}]]"
        formula_map.append({"placeholder": placeholder, "formula_text": value})
        chunks.append(placeholder)
        cursor = end
    chunks.append(prepared[cursor:])
    return "".join(chunks), formula_map


def protect_inline_formulas_in_segments(segments: list[dict]) -> tuple[str, list[dict]]:
    chunks: list[str] = []
    formula_map: list[dict] = []
    for segment in segments:
        content = segment.get("content", "").strip()
        if not content:
            continue
        if segment.get("type") == "inline_equation":
            placeholder = f"[[FORMULA_{len(formula_map) + 1}]]"
            formula_map.append({"placeholder": placeholder, "formula_text": content})
            chunks.append(placeholder)
        else:
            chunks.append(content)
    return " ".join(chunks), formula_map


def restore_inline_formulas(text: str, formula_map: list[dict]) -> str:
    restored = text
    for item in formula_map:
        restored = restored.replace(item["placeholder"], item["formula_text"])
    return restored


def re_protect_restored_formulas(text: str, formula_map: list[dict]) -> str:
    protected = text
    for item in sorted(formula_map, key=lambda entry: len(entry["formula_text"]), reverse=True):
        protected = protected.replace(item["formula_text"], item["placeholder"])
    return protected
