from __future__ import annotations

from services.document_schema.provider_adapters.common import normalize_polygon


def build_layout_box_lookup(layout_boxes: list[dict]) -> dict[tuple[float, float, float, float], dict]:
    lookup: dict[tuple[float, float, float, float], dict] = {}
    for box in layout_boxes or []:
        coordinate = box.get("coordinate")
        if not isinstance(coordinate, list) or len(coordinate) != 4:
            continue
        key = tuple(float(item or 0) for item in coordinate)
        lookup[key] = box
    return lookup


def attach_layout_trace(*, metadata: dict, bbox: list[float], layout_box_lookup: dict[tuple[float, float, float, float], dict]) -> dict:
    key = tuple(float(item or 0) for item in bbox)
    matched = layout_box_lookup.get(key)
    if not matched:
        metadata["layout_det_matched"] = False
        return metadata
    metadata["layout_det_matched"] = True
    metadata["layout_det_label"] = str(matched.get("label", "") or "")
    metadata["layout_det_cls_id"] = matched.get("cls_id")
    metadata["layout_det_score"] = matched.get("score")
    metadata["layout_det_order"] = matched.get("order")
    metadata["layout_det_polygon"] = normalize_polygon(matched.get("polygon_points"))
    return metadata


def build_page_trace(*, page_payload: dict, pruned: dict, preprocessed_image: str) -> dict:
    markdown = page_payload.get("markdown") or {}
    layout_boxes = ((pruned.get("layout_det_res") or {}).get("boxes") or [])
    return {
        "input_image": str(page_payload.get("inputImage", "") or ""),
        "preprocessed_image": str(preprocessed_image or ""),
        "raw_unit": "px",
        "provider_page_count": int(pruned.get("page_count", 0) or 0),
        "model_settings": dict(pruned.get("model_settings", {}) or {}),
        "markdown": {
            "text": str(markdown.get("text", "") or ""),
            "text_length": len(str(markdown.get("text", "") or "")),
            "images": dict(markdown.get("images", {}) or {}),
        },
        "output_images": dict(page_payload.get("outputImages", {}) or {}),
        "layout_det_res": {
            "box_count": len(layout_boxes),
            "boxes": [
                {
                    "label": str(box.get("label", "") or ""),
                    "cls_id": box.get("cls_id"),
                    "score": box.get("score"),
                    "order": box.get("order"),
                    "coordinate": [float(item or 0) for item in (box.get("coordinate") or [0, 0, 0, 0])][:4],
                    "polygon_points": normalize_polygon(box.get("polygon_points")),
                }
                for box in layout_boxes
                if isinstance(box, dict)
            ],
        },
    }


__all__ = [
    "attach_layout_trace",
    "build_layout_box_lookup",
    "build_page_trace",
]
