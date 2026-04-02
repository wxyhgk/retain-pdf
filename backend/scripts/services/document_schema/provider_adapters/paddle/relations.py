from __future__ import annotations

from services.document_schema.provider_adapters.common import classify_with_previous_anchor
from services.document_schema.provider_adapters.paddle.block_labels import map_block_kind


def classify_page_blocks(parsing_res_list: list[dict]) -> list[tuple[str, str, list[str], dict]]:
    return classify_with_previous_anchor(
        parsing_res_list,
        label_getter=lambda block: str(block.get("block_label", "") or ""),
        resolver=_resolve_block_kind,
        anchor_getter=lambda kind: (kind[0], kind[1]),
    )


def _resolve_block_kind(block: dict, previous_anchor: tuple[str, int] | None) -> tuple[str, str, list[str], dict]:
    raw_label = str(block.get("block_label", "") or "")
    text = str(block.get("block_content", "") or "").strip()
    label = raw_label.strip().lower()
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
    lowered = text.lower()
    if "table" in lowered:
        return "text", "table_caption", ["caption", "table_caption"], {"caption_target": "table"}
    if "figure" in lowered:
        return "text", "image_caption", ["caption", "image_caption"], {"caption_target": "image"}
    if "listing" in lowered:
        if previous_anchor and previous_anchor[0] == "code_block":
            return "text", "code_caption", ["caption", "code_caption"], {"caption_target": "code"}
        return "text", "image_caption", ["caption", "image_caption"], {"caption_target": "image"}
    if previous_anchor:
        target = previous_anchor[0]
        if target in {"table_html", "table"}:
            return "text", "table_caption", ["caption", "table_caption"], {"caption_target": "table"}
        if target in {"image_body", "image"}:
            return "text", "image_caption", ["caption", "image_caption"], {"caption_target": "image"}
        if target in {"code_block", "code"}:
            return "text", "code_caption", ["caption", "code_caption"], {"caption_target": "code"}
    return "text", "caption", ["caption"], {"caption_target": "unknown"}


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
