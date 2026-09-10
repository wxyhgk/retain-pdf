from __future__ import annotations

from statistics import median

from retainpdf_pipeline.translate.core.item_reader import item_is_textual


MIN_SINGLE_COLUMN_MAIN_ITEMS = 3
MIN_DOUBLE_COLUMN_MAIN_ITEMS = 3
MIN_TWO_COLUMN_GAP_RATIO = 0.18
FULL_WIDTH_RATIO = 0.78
PROVIDER_COLUMN_GUESSES = {"left", "right", "full"}


def bbox_width(item: dict) -> float:
    bbox = item.get("bbox", [])
    return max(0.0, bbox[2] - bbox[0]) if len(bbox) == 4 else 0.0


def bbox_height(item: dict) -> float:
    bbox = item.get("bbox", [])
    return max(0.0, bbox[3] - bbox[1]) if len(bbox) == 4 else 0.0


def bbox_center_x(item: dict) -> float:
    bbox = item.get("bbox", [])
    return (bbox[0] + bbox[2]) / 2 if len(bbox) == 4 else 0.0


def page_width(items: list[dict]) -> float:
    boxes = [item.get("bbox", []) for item in items if len(item.get("bbox", [])) == 4]
    if not boxes:
        return 0.0
    x0 = min(box[0] for box in boxes)
    x1 = max(box[2] for box in boxes)
    return max(0.0, x1 - x0)


def detect_columns_from_main_items(
    main_items: list[dict],
    *,
    min_single_column_items: int = MIN_SINGLE_COLUMN_MAIN_ITEMS,
    min_double_column_items: int = MIN_DOUBLE_COLUMN_MAIN_ITEMS,
    min_two_column_gap_ratio: float = MIN_TWO_COLUMN_GAP_RATIO,
) -> tuple[str, float]:
    if len(main_items) < (min_single_column_items * 2):
        return "single", 0.0
    width = page_width(main_items)
    if width <= 0:
        return "single", 0.0
    centers = sorted((bbox_center_x(item), idx, item) for idx, item in enumerate(main_items))
    gaps = []
    for idx in range(len(centers) - 1):
        gaps.append((centers[idx + 1][0] - centers[idx][0], idx))
    if not gaps:
        return "single", 0.0
    largest_gap, gap_idx = max(gaps, key=lambda entry: entry[0])
    if largest_gap < width * min_two_column_gap_ratio:
        return "single", 0.0
    split_x = (centers[gap_idx][0] + centers[gap_idx + 1][0]) / 2
    left = [item for center, _, item in centers if center < split_x]
    right = [item for center, _, item in centers if center >= split_x]
    if len(left) < min_double_column_items or len(right) < min_double_column_items:
        return "single", 0.0
    return "double", split_x


def _flow_candidate(item: dict) -> bool:
    if not item_is_textual(item):
        return False
    if not item.get("source_text", "").strip():
        return False
    if len(item.get("bbox", [])) != 4:
        return False
    return True


def detect_page_layout(items: list[dict]) -> tuple[str, float, float]:
    flow_items = [item for item in items if _flow_candidate(item)]
    provider_layout = _detect_provider_page_layout(flow_items)
    if provider_layout is not None:
        layout_mode, split_x = provider_layout
        flow_widths = [bbox_width(item) for item in flow_items if _provider_column_guess(item) != "full"]
        median_flow_width = median(flow_widths) if flow_widths else 0.0
        return layout_mode, split_x, median_flow_width
    layout_mode, split_x = detect_columns_from_main_items(flow_items)
    flow_widths = [bbox_width(item) for item in flow_items]
    median_flow_width = median(flow_widths) if flow_widths else 0.0
    return layout_mode, split_x, median_flow_width


def _provider_column_layout_mode(item: dict) -> str:
    return str(
        item.get("provider_column_layout_mode")
        or (item.get("metadata") or {}).get("column_layout_mode")
        or (item.get("metadata") or {}).get("provider_column_layout_mode")
        or ""
    ).strip().lower()


def _provider_column_guess(item: dict) -> str:
    value = str(
        item.get("provider_column_index_guess")
        or (item.get("metadata") or {}).get("column_index_guess")
        or (item.get("metadata") or {}).get("provider_column_index_guess")
        or ""
    ).strip().lower()
    return value if value in PROVIDER_COLUMN_GUESSES else ""


def _detect_provider_page_layout(flow_items: list[dict]) -> tuple[str, float] | None:
    provider_double_items = [
        item
        for item in flow_items
        if _provider_column_layout_mode(item) == "double"
    ]
    if len(provider_double_items) < MIN_SINGLE_COLUMN_MAIN_ITEMS:
        return None
    left_items = [item for item in provider_double_items if _provider_column_guess(item) == "left"]
    right_items = [item for item in provider_double_items if _provider_column_guess(item) == "right"]
    if len(left_items) < 2 or len(right_items) < 2:
        return None
    left_centers = [bbox_center_x(item) for item in left_items]
    right_centers = [bbox_center_x(item) for item in right_items]
    if not left_centers or not right_centers:
        return None
    split_x = (max(left_centers) + min(right_centers)) / 2
    if split_x <= 0:
        return None
    return "double", split_x


def annotate_payload_layout_zones(payload: list[dict]) -> tuple[str, float]:
    layout_mode, split_x, median_flow_width = detect_page_layout(payload)
    width = page_width(payload)
    full_width_threshold = max(median_flow_width * 1.45, width * FULL_WIDTH_RATIO) if width > 0 else 0.0

    for item in payload:
        item["layout_mode"] = layout_mode
        item["layout_split_x"] = round(split_x, 2) if split_x else 0.0
        zone = "non_flow"
        if _flow_candidate(item):
            item_width = bbox_width(item)
            if layout_mode == "double":
                provider_guess = _provider_column_guess(item)
                if provider_guess == "full":
                    zone = "full_width"
                elif provider_guess in {"left", "right"}:
                    zone = f"{provider_guess}_column"
                elif full_width_threshold > 0 and item_width >= full_width_threshold:
                    zone = "full_width"
                else:
                    zone = "left_column" if bbox_center_x(item) < split_x else "right_column"
            else:
                zone = "single_column"
        item["layout_zone"] = zone
        item["layout_zone_rank"] = -1
        item["layout_zone_size"] = 0
        item["layout_boundary_role"] = ""

    zone_items: dict[str, list[dict]] = {}
    for item in payload:
        zone = str(item.get("layout_zone", "") or "")
        if zone == "non_flow":
            continue
        zone_items.setdefault(zone, []).append(item)

    for zone, items in zone_items.items():
        ordered = sorted(
            items,
            key=lambda item: (
                (item.get("bbox", [0, 0, 0, 0])[1] if len(item.get("bbox", [])) == 4 else 0),
                (item.get("bbox", [0, 0, 0, 0])[0] if len(item.get("bbox", [])) == 4 else 0),
            ),
        )
        size = len(ordered)
        for idx, item in enumerate(ordered):
            item["layout_zone_rank"] = idx
            item["layout_zone_size"] = size
            if size == 1:
                role = "single"
            elif idx == 0:
                role = "head"
            elif idx == size - 1:
                role = "tail"
            else:
                role = "middle"
            item["layout_boundary_role"] = role
    return layout_mode, split_x
