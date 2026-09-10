from __future__ import annotations

from html import unescape
import re

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import classify_with_previous_anchor
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.block_labels import map_block_kind


_PADDLE_METADATA_TEXT_RE = re.compile(
    r"(?:^keywords?\s*:|^doi:|^cite this article as:|submit your manuscript here|open access|copyright|"
    r"authors declare|competing interests?|competing financial interest|funded by|received:|accepted:|published:|"
    r"supporting information is available free of charge|e-mail:|orcid)",
    re.I,
)
_PADDLE_METADATA_BULLET_RE = re.compile(
    r"^[•▪◦]\s*(?:keywords?\s*:|doi:|cite this article as:|submit your manuscript here|open access|copyright|"
    r"authors declare|competing interests?|competing financial interest|funded by|received:|accepted:|published:|"
    r"supporting information is available free of charge|e-mail:|orcid)",
    re.I,
)
_ASCII_WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?")
_ANCILLARY_TAIL_HEADINGS = {
    "competing interests",
    "authors' contributions",
    "acknowledgments",
    "references",
}


def classify_page_blocks(parsing_res_list: list[dict]) -> list[tuple[str, str, list[str], dict]]:
    body_flow_start_order = _body_flow_start_order(parsing_res_list)

    def resolver(block: dict, previous_anchor: tuple[str, int] | None) -> tuple[str, str, list[str], dict]:
        return _resolve_block_kind(
            block,
            previous_anchor,
            order=int(block.get("__rp_order__", -1) or -1),
            body_flow_start_order=body_flow_start_order,
        )

    enriched_blocks = [
        {
            **dict(block or {}),
            "__rp_order__": order,
        }
        for order, block in enumerate(parsing_res_list or [])
    ]
    return classify_with_previous_anchor(
        enriched_blocks,
        label_getter=lambda block: str(block.get("block_label", "") or ""),
        resolver=resolver,
        anchor_getter=lambda kind: (kind[0], kind[1]),
    )


def _resolve_block_kind(
    block: dict,
    previous_anchor: tuple[str, int] | None,
    *,
    order: int,
    body_flow_start_order: int,
) -> tuple[str, str, list[str], dict]:
    raw_label = str(block.get("block_label", "") or "")
    text = str(block.get("block_content", "") or "").strip()
    label = raw_label.strip().lower()
    if label == "text" and body_flow_start_order >= 0 and 0 <= order < body_flow_start_order:
        return "text", "metadata", ["metadata", "skip_translation"], {"front_matter_text": True}
    if label == "text" and _looks_like_metadata_text(text):
        return "text", "metadata", ["metadata", "skip_translation"], {"metadata_text_cue": True}
    if label == "paragraph_title" and _looks_like_ancillary_tail_heading(text):
        return "text", "metadata", ["metadata", "skip_translation"], {"ancillary_tail_heading": True}
    if label == "figure_title":
        return resolve_figure_title(text=text, previous_anchor=previous_anchor)
    if label == "vision_footnote":
        return resolve_vision_footnote(text=text, previous_anchor=previous_anchor)
    return map_block_kind(raw_label, text=text)


def resolve_figure_title(
    *,
    text: str,
    previous_anchor: tuple[str, int] | None,
) -> tuple[str, str, list[str], dict]:
    del previous_anchor
    plain_text = " ".join(unescape(re.sub(r"<[^>]+>", " ", text or "")).split())
    if re.match(r"^(?:table\b|表(?:格)?\s*\d)", plain_text, flags=re.IGNORECASE):
        return "text", "table_caption", ["caption", "table_caption"], {"caption_target": "table"}
    return "text", "figure_caption", ["caption", "figure_caption"], {"caption_target": "figure"}


def resolve_vision_footnote(
    *,
    text: str,
    previous_anchor: tuple[str, int] | None,
) -> tuple[str, str, list[str], dict]:
    lowered = text.lower()
    if lowered.startswith("表注") or "table" in lowered:
        return "text", "table_footnote", ["footnote", "table_footnote"], {"footnote_target": "table"}
    if lowered.startswith("图注") or "figure" in lowered:
        return "text", "image_footnote", ["footnote", "image_footnote"], {"footnote_target": "image"}
    if previous_anchor:
        target = previous_anchor[0]
        if target in {"table_html", "table"}:
            return "text", "table_footnote", ["footnote", "table_footnote"], {"footnote_target": "table"}
        if target in {"image_body", "image"}:
            return "text", "image_footnote", ["footnote", "image_footnote"], {"footnote_target": "image"}
    return "text", "footnote", ["footnote"], {"footnote_target": "unknown"}


def _body_flow_start_order(parsing_res_list: list[dict]) -> int:
    has_front_matter = False
    front_matter_end_order = -1
    for order, block in enumerate(parsing_res_list or []):
        label = str((block.get("block_label", "") or "")).strip().lower()
        text = " ".join(str(block.get("block_content", "") or "").split()).strip().lower()
        if label in {"doc_title", "abstract"}:
            has_front_matter = True
            front_matter_end_order = order
            continue
        if label == "paragraph_title" and text == "abstract":
            has_front_matter = True
            front_matter_end_order = order
            continue
    if not has_front_matter:
        return -1

    for order, block in enumerate(parsing_res_list or []):
        if order <= front_matter_end_order:
            continue
        label = str((block.get("block_label", "") or "")).strip().lower()
        text = " ".join(str(block.get("block_content", "") or "").split()).strip().lower()
        if label == "paragraph_title" and text and text != "abstract" and not _looks_like_ancillary_tail_heading(text):
            return order
        if label in {"text", "abstract"} and text and not _looks_like_metadata_text(text):
            return order
    return -1


def _looks_like_metadata_text(text: str) -> bool:
    compact = " ".join((text or "").split()).strip()
    if not compact:
        return False
    if _is_short_metadata_bullet(compact):
        return True
    return bool(_PADDLE_METADATA_TEXT_RE.search(compact))


def _looks_like_ancillary_tail_heading(text: str) -> bool:
    compact = " ".join((text or "").split()).strip().lower()
    return compact in _ANCILLARY_TAIL_HEADINGS


def _ascii_word_count(text: str) -> int:
    return len(_ASCII_WORD_RE.findall(text or ""))


def _is_short_metadata_bullet(text: str) -> bool:
    compact = " ".join((text or "").split()).strip()
    if not compact or not _PADDLE_METADATA_BULLET_RE.search(compact):
        return False
    return _ascii_word_count(compact) <= 24
