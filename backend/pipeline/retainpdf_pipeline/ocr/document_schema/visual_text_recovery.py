"""Match visual OCR output to the missing slots of a damaged text block."""
from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable, Sequence

from retainpdf_pipeline.ocr.document_schema.estimated_lines import DOLLAR_MATH_RE

RecognizeCrop = Callable[[bytes], str | None]
_GAP = re.compile(r"\ufffd+")
_MAX_CROP_EDGE_PX = 2400


def _anchored_parts(text: str) -> list[str]:
    parts = _GAP.split(text)
    if (len(parts) < 2 or any(not part.strip() for part in parts)
            or sum(c.isalnum() for c in parts[0]) < 3
            or sum(c.isalnum() for c in parts[-1]) < 3
            or sum(c.isalnum() for part in parts for c in part) < 12
            or any("\ufffd" in m[0] for m in DOLLAR_MATH_RE.finditer(text))):
        return []
    return parts


def can_match_visual_recovery(text: str) -> bool:
    return bool(_anchored_parts(text))


def _tokens(text: str, formulas: list[str]) -> list[tuple[str, str]]:
    """Keep each inline formula atomic and retain its original LaTeX."""
    # Canonical provider text may omit dollar delimiters even though its
    # segments identify intact formulas. Delimit only for comparison; the
    # original content and formulas are never rewritten by this matcher.
    if "$" not in text and formulas:
        pattern = re.compile("|".join(re.escape(value) for value in sorted(formulas, key=len, reverse=True)))
        text = pattern.sub(lambda match: "$" + match[0] + "$", text)
    tokens = []
    cursor = 0
    for math in DOLLAR_MATH_RE.finditer(text):
        tokens.extend(("text", c) for c in unicodedata.normalize("NFKC", text[cursor:math.start()]) if not c.isspace())
        if math["display"] is not None:
            tokens.append(("display", math[0]))
        else:
            tex = re.sub(r"\s+", "", math["inline"])
            # Both spellings encode the same single-character index. Do not
            # simplify arbitrary braces, commands, or multi-character indices.
            tex = re.sub(r"([_^])\{([A-Za-z0-9])\}", r"\1\2", tex)
            tokens.append(("math", "$" + tex + "$"))
        cursor = math.end()
    tokens.extend(("text", c) for c in unicodedata.normalize("NFKC", text[cursor:]) if not c.isspace())
    return tokens


def visual_replacements(original: str, recognized: str, *, segments: Sequence[dict] = ()) -> list[str]:
    """Require exact agreement outside gaps; allow one glyph or formula per gap."""
    if "\ufffd" in recognized:
        return []
    formulas = [
        span["text"] for span in segments
        if span.get("type") == "inline_formula" and span.get("text") and "\ufffd" not in span["text"]
    ]
    anchors = [_tokens(part, formulas) for part in _anchored_parts(original)]
    if not anchors:
        return []
    candidate = _tokens(recognized, [])
    if len(candidate) != sum(map(len, anchors)) + len(anchors) - 1:
        return []
    cursor = 0
    replacements = []
    for index, anchor in enumerate(anchors):
        if candidate[cursor:cursor + len(anchor)] != anchor:
            return []
        cursor += len(anchor)
        if index == len(anchors) - 1:
            break
        kind, value = candidate[cursor]
        if kind == "math" and len(value) <= 128 and not re.search(r"[<>]", value):
            replacements.append(value)
        elif kind == "text" and value.isalnum():
            replacements.append(value)
        else:
            return []
        cursor += 1
    return replacements


def recognize_pdf_region(page, bbox, recognize: RecognizeCrop) -> str | None:
    clip = bbox & page.rect
    if clip.is_empty:
        return None
    scale = min(300 / 72, _MAX_CROP_EDGE_PX / max(clip.width, clip.height))
    return recognize(page.get_pixmap(matrix=(scale, scale), clip=clip, alpha=False, annots=False).tobytes("png"))
