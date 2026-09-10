from __future__ import annotations

from typing import Any

from retainpdf_pipeline.render.visual_profile.contracts import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import ItemVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import PageVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import SUPPORTED_VISUAL_PROFILE_ALGORITHMS
from retainpdf_pipeline.render.visual_profile.contracts import clamp_bbox
from retainpdf_pipeline.render.visual_profile.contracts import clamp_color
from retainpdf_pipeline.render.visual_profile.contracts import clamp_confidence


def document_visual_profile_to_manifest(profile: DocumentVisualProfile) -> dict[str, Any]:
    return {
        "algorithm": profile.algorithm,
        "pages": {
            str(page_index): _page_to_manifest(page)
            for page_index, page in sorted(profile.pages.items())
        },
    }


def document_visual_profile_from_manifest(payload: object) -> DocumentVisualProfile:
    data = dict(payload or {})
    algorithm = str(data.get("algorithm") or "")
    if algorithm not in SUPPORTED_VISUAL_PROFILE_ALGORITHMS:
        return DocumentVisualProfile(algorithm=algorithm, pages={})
    pages: dict[int, PageVisualProfile] = {}
    for raw_page_index, raw_page in dict(data.get("pages") or {}).items():
        try:
            page_index = int(raw_page_index)
        except (TypeError, ValueError):
            continue
        page = _page_from_manifest(page_index, raw_page)
        pages[page_index] = page
    return DocumentVisualProfile(algorithm=algorithm, pages=pages)


def _page_to_manifest(page: PageVisualProfile) -> dict[str, Any]:
    return {
        "background_rgb": _round_color(page.background_rgb),
        "warnings": list(page.warnings),
        "items": {
            item_id: _item_to_manifest(item)
            for item_id, item in sorted(page.items.items())
        },
    }


def _item_to_manifest(item: ItemVisualProfile) -> dict[str, Any]:
    return {
        "page_index": item.page_index,
        "bbox": [round(float(value), 3) for value in item.bbox],
        "bbox_space": item.bbox_space,
        "bbox_source": item.bbox_source,
        "source_item_kind": item.source_item_kind,
        "background_rgb": _round_color(item.background_rgb),
        "text_rgb": _round_color(item.text_rgb),
        "confidence": round(float(item.confidence), 4),
        "method": item.method,
        "warnings": list(item.warnings),
    }


def _page_from_manifest(page_index: int, payload: object) -> PageVisualProfile:
    data = dict(payload or {})
    items: dict[str, ItemVisualProfile] = {}
    for item_id, raw_item in dict(data.get("items") or {}).items():
        item = _item_from_manifest(str(item_id), raw_item)
        items[item.item_id] = item
    return PageVisualProfile(
        page_index=page_index,
        background_rgb=clamp_color(data.get("background_rgb")),
        items=items,
        warnings=tuple(str(value) for value in list(data.get("warnings") or []) if value),
    )


def _item_from_manifest(item_id: str, payload: object) -> ItemVisualProfile:
    data = dict(payload or {})
    return ItemVisualProfile(
        item_id=item_id,
        page_index=int(data.get("page_index") or 0),
        bbox=clamp_bbox(data.get("bbox")),
        bbox_space=str(data.get("bbox_space") or "page_pt"),
        bbox_source=str(data.get("bbox_source") or "unknown"),
        source_item_kind=str(data.get("source_item_kind") or ""),
        background_rgb=clamp_color(data.get("background_rgb")),
        text_rgb=clamp_color(data.get("text_rgb"), default=(0.0, 0.0, 0.0)),
        confidence=clamp_confidence(float(data.get("confidence") or 0.0)),
        method=str(data.get("method") or ""),
        warnings=tuple(str(value) for value in list(data.get("warnings") or []) if value),
    )


def _round_color(color: tuple[float, float, float]) -> list[float]:
    return [round(float(component), 5) for component in color]
