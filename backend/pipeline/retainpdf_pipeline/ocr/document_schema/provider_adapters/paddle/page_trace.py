from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import normalize_polygon


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


def build_page_trace(
    *,
    page_index: int,
    page_payload: dict,
    page_meta: dict | None,
    pruned: dict,
    preprocessed_image: str,
    column_signals: dict | None = None,
    block_ids: list[str] | None = None,
) -> dict:
    markdown = page_payload.get("markdown") or {}
    markdown_images = dict(markdown.get("images", {}) or {})
    layout_boxes = ((pruned.get("layout_det_res") or {}).get("boxes") or [])
    column_signals = dict(column_signals or {})
    suspected_orders = list(column_signals.get("suspected_orders", []) or [])
    block_ids = list(block_ids or [])
    cli_metadata = dict(page_payload.get("_cli") or {})
    page_meta = dict(page_meta or {})
    return {
        "input_image": str(page_payload.get("inputImage", "") or ""),
        "preprocessed_image": str(preprocessed_image or ""),
        "raw_unit": "px",
        "provider_page_count": int(pruned.get("page_count", 0) or 0),
        # Keep the complete provider page metadata.  Width/height are consumed
        # by the canonical page record, but newer Paddle fields must remain
        # queryable without reopening the raw JSONL transport artifact.
        "provider_page_meta": page_meta,
        "model_settings": dict(pruned.get("model_settings", {}) or {}),
        "markdown": {
            "text": str(markdown.get("text", "") or ""),
            "text_length": len(str(markdown.get("text", "") or "")),
            "images": {
                str(key): f"md/images/page-{page_index + 1}/{str(key).lstrip('/')}"
                for key in markdown_images
            },
        },
        "output_images": dict(page_payload.get("outputImages", {}) or {}),
        "provider_transport": str(cli_metadata.get("transport", "") or ""),
        "geometry_precision": str(cli_metadata.get("geometry_precision", "") or ""),
        "column_layout_mode": str(column_signals.get("column_layout_mode", "") or "unknown"),
        "column_split_x": float(column_signals.get("split_x", 0.0) or 0.0),
        "suspected_cross_column_merge_block_count": int(column_signals.get("suspected_count", 0) or 0),
        "suspected_block_ids": [
            block_ids[order]
            for order in suspected_orders
            if isinstance(order, int) and 0 <= order < len(block_ids)
        ],
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
