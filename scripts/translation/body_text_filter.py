import re
from statistics import median

from orchestration.zones import bbox_center_x
from orchestration.zones import bbox_height
from orchestration.zones import bbox_width
from orchestration.zones import detect_columns_from_main_items

BODY_WIDTH_SKIP_RATIO = 0.5
MIN_MAIN_TEXT_LEN = 40
MIN_SINGLE_COLUMN_MAIN_ITEMS = 3
MIN_DOUBLE_COLUMN_MAIN_ITEMS = 3
MIN_TWO_COLUMN_GAP_RATIO = 0.18
MIN_MAIN_BOX_HEIGHT = 42


def _text_len(item: dict) -> int:
    return len(re.sub(r"\s+", "", item.get("source_text", "")))


def _line_count(item: dict) -> int:
    return len(item.get("lines", []))


def _has_inline_formula(item: dict) -> bool:
    return bool(item.get("formula_map"))


def _structure_role(item: dict) -> str:
    return str(item.get("metadata", {}).get("structure_role", "") or "")


def _is_body_text_candidate(item: dict) -> bool:
    if item.get("block_type") != "text":
        return False
    if not item.get("should_translate", True):
        return False
    if str(item.get("translation_unit_id", "") or "").startswith("__cg__:") or item.get("continuation_group"):
        return False
    if _structure_role(item) not in {"", "body"}:
        return False
    return True


def _is_main_body_width_item(item: dict) -> bool:
    if not _is_body_text_candidate(item):
        return False
    if _has_inline_formula(item):
        return False
    if _text_len(item) < MIN_MAIN_TEXT_LEN:
        return False
    return _line_count(item) >= 2 or bbox_height(item) >= MIN_MAIN_BOX_HEIGHT


def _page_width(items: list[dict]) -> float:
    xs = [item.get("bbox", []) for item in items if len(item.get("bbox", [])) == 4]
    if not xs:
        return 0.0
    x0 = min(b[0] for b in xs)
    x1 = max(b[2] for b in xs)
    return max(0.0, x1 - x0)


def _detect_columns(main_items: list[dict]) -> tuple[str, float]:
    return detect_columns_from_main_items(
        main_items,
        min_single_column_items=MIN_SINGLE_COLUMN_MAIN_ITEMS,
        min_double_column_items=MIN_DOUBLE_COLUMN_MAIN_ITEMS,
        min_two_column_gap_ratio=MIN_TWO_COLUMN_GAP_RATIO,
    )


def _column_reference_widths(items: list[dict]) -> tuple[str, float, float, float]:
    main_items = [item for item in items if _is_main_body_width_item(item)]
    if not main_items:
        return "single", 0.0, 0.0, 0.0

    layout, split_x = _detect_columns(main_items)
    if layout == "single":
        widths = [bbox_width(item) for item in main_items]
        return layout, split_x, median(widths) if widths else 0.0, 0.0

    left_widths = [bbox_width(item) for item in main_items if bbox_center_x(item) < split_x]
    right_widths = [bbox_width(item) for item in main_items if bbox_center_x(item) >= split_x]
    return (
        layout,
        split_x,
        median(left_widths) if left_widths else 0.0,
        median(right_widths) if right_widths else 0.0,
    )


def _reference_width_for_item(item: dict, layout: str, split_x: float, left_ref: float, right_ref: float) -> float:
    if layout != "double":
        return left_ref
    return left_ref if bbox_center_x(item) < split_x else right_ref


def _looks_like_short_noise(item: dict) -> bool:
    if _has_inline_formula(item):
        return False
    if _line_count(item) > 2:
        return False
    text = (item.get("source_text") or "").strip()
    if len(text) > 100:
        return False
    if _text_len(item) > 80:
        return False
    if bbox_height(item) > 28:
        return False
    return True


def find_narrow_body_noise_item_ids(payload: list[dict]) -> set[str]:
    layout, split_x, left_ref, right_ref = _column_reference_widths(payload)
    if layout == "single" and left_ref <= 0:
        return set()
    if layout == "double" and left_ref <= 0 and right_ref <= 0:
        return set()

    skipped: set[str] = set()
    for item in payload:
        if not _is_body_text_candidate(item):
            continue
        if not _looks_like_short_noise(item):
            continue
        ref_width = _reference_width_for_item(item, layout, split_x, left_ref, right_ref)
        if ref_width <= 0:
            continue
        if bbox_width(item) < ref_width * BODY_WIDTH_SKIP_RATIO:
            skipped.add(item.get("item_id", ""))
    return skipped
