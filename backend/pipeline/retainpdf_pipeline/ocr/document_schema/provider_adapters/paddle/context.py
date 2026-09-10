from __future__ import annotations

from typing import TypedDict


class PaddlePageContext(TypedDict):
    page_index: int
    page_payload: dict
    page_meta: dict
    preprocessed_image: str
    pruned: dict
    parsing_res_list: list[dict]
    layout_box_lookup: dict[tuple[float, float, float, float], dict]
    markdown_text: str
    markdown_images: dict[str, str]
    classified_kinds: list[tuple[str, str, list[str], dict]]
    column_signals: dict
    repair_metadata: dict[int, dict]
    repair_summary: dict


class PaddleBlockContext(TypedDict):
    page: PaddlePageContext
    block: dict
    order: int
    resolved_kind: tuple[str, str, list[str], dict]
    raw_label: str
    bbox: list[float]
    text: str
    signal_metadata: dict


__all__ = [
    "PaddleBlockContext",
    "PaddlePageContext",
]
