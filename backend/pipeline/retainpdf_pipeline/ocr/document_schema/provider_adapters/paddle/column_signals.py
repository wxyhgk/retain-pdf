from __future__ import annotations

from statistics import median

TEXTISH_LABELS = {
    "abstract",
    "aside_text",
    "doc_title",
    "figure_title",
    "footnote",
    "header",
    "number",
    "paragraph_title",
    "reference_content",
    "text",
    "vision_footnote",
}

NON_BODY_SIGNAL_LABELS = {
    "aside_text",
    "footnote",
    "footer",
    "footer_image",
    "header",
    "header_image",
    "number",
    "vision_footnote",
}


def analyze_page_column_signals(
    *,
    parsing_res_list: list[dict],
    page_width: float,
) -> dict:
    valid_blocks = []
    left_centers = []
    right_centers = []
    for order, block in enumerate(parsing_res_list or []):
        bbox = _bbox(block)
        if not bbox:
            continue
        label = str(block.get("block_label", "") or "").strip().lower()
        text = str(block.get("block_content", "") or "").strip()
        width = bbox[2] - bbox[0]
        center_x = (bbox[0] + bbox[2]) / 2.0
        column_guess = _column_guess(bbox, page_width)
        record = {
            "order": order,
            "bbox": bbox,
            "label": label,
            "text": text,
            "empty_text": len(text) < 2,
            "column_guess": column_guess,
        }
        valid_blocks.append(record)
        if label in TEXTISH_LABELS and text and page_width > 0:
            width_ratio = width / page_width
            if 0.18 <= width_ratio <= 0.48:
                if column_guess == "left":
                    left_centers.append(center_x)
                elif column_guess == "right":
                    right_centers.append(center_x)

    left_slot_count = sum(
        1
        for record in valid_blocks
        if record["label"] in TEXTISH_LABELS and record["column_guess"] == "left" and _is_column_sized(record["bbox"], page_width)
    )
    right_slot_count = sum(
        1
        for record in valid_blocks
        if record["label"] in TEXTISH_LABELS and record["column_guess"] == "right" and _is_column_sized(record["bbox"], page_width)
    )

    if page_width <= 0 or (
        len(left_centers) < 2
        or len(right_centers) < 2
    ) and not _looks_like_sparse_double_column(left_slot_count, right_slot_count, valid_blocks):
        mode = "single"
        split_x = page_width / 2.0 if page_width > 0 else 0.0
    else:
        mode = "double"
        if left_centers and right_centers:
            split_x = (median(left_centers) + median(right_centers)) / 2.0
        else:
            split_x = page_width / 2.0 if page_width > 0 else 0.0

    suspicious_orders: set[int] = set()
    peer_orders: dict[int, int] = {}
    empty_bbox_orders: set[int] = set()
    absorber_orders: set[int] = set()
    if mode == "double":
        for current in valid_blocks:
            if (
                current["empty_text"]
                or current["column_guess"] not in {"left", "right"}
                or current["label"] in NON_BODY_SIGNAL_LABELS
            ):
                continue
            for neighbor in _candidate_neighbors(valid_blocks, current["order"]):
                if not neighbor["empty_text"]:
                    continue
                if neighbor["label"] in NON_BODY_SIGNAL_LABELS:
                    continue
                if neighbor["column_guess"] == current["column_guess"]:
                    continue
                if neighbor["column_guess"] not in {"left", "right"}:
                    continue
                if not _vertical_overlap(current["bbox"], neighbor["bbox"]):
                    continue
                suspicious_orders.add(current["order"])
                suspicious_orders.add(neighbor["order"])
                peer_orders[current["order"]] = neighbor["order"]
                peer_orders[neighbor["order"]] = current["order"]
                absorber_orders.add(current["order"])
                empty_bbox_orders.add(neighbor["order"])

    block_signals: dict[int, dict] = {}
    for record in valid_blocks:
        suspicious = record["order"] in suspicious_orders
        peer_order = peer_orders.get(record["order"])
        text_missing_but_bbox_present = record["order"] in empty_bbox_orders
        peer_block_absorbed_text = record["order"] in absorber_orders
        block_signals[record["order"]] = {
            "provider_cross_column_merge_suspected": suspicious,
            "provider_reading_order_unreliable": suspicious,
            "provider_structure_unreliable": suspicious,
            "provider_text_missing_but_bbox_present": text_missing_but_bbox_present,
            "provider_peer_block_absorbed_text": peer_block_absorbed_text,
            "provider_suspected_peer_order": peer_order,
            "provider_column_layout_mode": mode if page_width > 0 else "unknown",
            "provider_column_index_guess": record["column_guess"],
        }

    return {
        "column_layout_mode": mode if page_width > 0 else "unknown",
        "split_x": round(split_x, 3) if split_x else 0.0,
        "suspected_orders": sorted(suspicious_orders),
        "suspected_count": len(suspicious_orders),
        "empty_bbox_orders": sorted(empty_bbox_orders),
        "absorber_orders": sorted(absorber_orders),
        "block_signals": block_signals,
    }


def summarize_document_column_signals(pages: list[dict]) -> dict:
    page_summaries = []
    suspicious_pages = 0
    suspicious_blocks = 0
    for page in pages:
        metadata = dict(page.get("metadata", {}) or {})
        count = int(metadata.get("suspected_cross_column_merge_block_count", 0) or 0)
        empty_bbox_count = int(metadata.get("text_missing_but_bbox_present_count", 0) or 0)
        absorber_count = int(metadata.get("peer_block_absorbed_text_count", 0) or 0)
        if count > 0:
            suspicious_pages += 1
            suspicious_blocks += count
        page_summaries.append(
            {
                "page_index": int(page.get("page_index", 0) or 0),
                "column_layout_mode": str(metadata.get("column_layout_mode", "") or "unknown"),
                "suspected_cross_column_merge_block_count": count,
                "suspected_block_ids": list(metadata.get("suspected_block_ids", []) or []),
                "text_missing_but_bbox_present_count": empty_bbox_count,
                "text_missing_but_bbox_present_block_ids": list(
                    metadata.get("text_missing_but_bbox_present_block_ids", []) or []
                ),
                "peer_block_absorbed_text_count": absorber_count,
                "peer_block_absorbed_text_block_ids": list(
                    metadata.get("peer_block_absorbed_text_block_ids", []) or []
                ),
            }
        )
    return {
        "provider": "paddle",
        "suspicious_cross_column_merge_pages": suspicious_pages,
        "suspicious_cross_column_merge_blocks": suspicious_blocks,
        "pages": page_summaries,
    }


def _candidate_neighbors(records: list[dict], order: int) -> list[dict]:
    result = []
    for offset in (-1, 1):
        target = order + offset
        for record in records:
            if record["order"] == target:
                result.append(record)
                break
    return result


def _looks_like_sparse_double_column(left_slot_count: int, right_slot_count: int, records: list[dict]) -> bool:
    if left_slot_count >= 2 and right_slot_count >= 2:
        return True
    if left_slot_count < 1 or right_slot_count < 1:
        return False
    return any(record["empty_text"] and record["column_guess"] in {"left", "right"} for record in records)


def _is_column_sized(bbox: list[float], page_width: float) -> bool:
    if len(bbox) != 4 or page_width <= 0:
        return False
    width = bbox[2] - bbox[0]
    width_ratio = width / page_width
    return 0.18 <= width_ratio <= 0.48


def _bbox(block: dict) -> list[float]:
    value = block.get("block_bbox") or []
    if not isinstance(value, list) or len(value) != 4:
        return []
    try:
        return [float(item or 0) for item in value[:4]]
    except (TypeError, ValueError):
        return []


def _column_guess(bbox: list[float], page_width: float) -> str:
    if len(bbox) != 4 or page_width <= 0:
        return "unknown"
    width = max(0.0, bbox[2] - bbox[0])
    if width >= page_width * 0.62:
        return "full"
    center_x = (bbox[0] + bbox[2]) / 2.0
    return "left" if center_x <= page_width / 2.0 else "right"


def _vertical_overlap(a: list[float], b: list[float]) -> bool:
    if len(a) != 4 or len(b) != 4:
        return False
    overlap = min(a[3], b[3]) - max(a[1], b[1])
    min_height = min(max(1.0, a[3] - a[1]), max(1.0, b[3] - b[1]))
    return overlap >= min_height * 0.25
