from __future__ import annotations
BODY_FONT_SIZE_FACTOR = 0.9215
BODY_LEADING_FACTOR = 0.988
INNER_BBOX_SHRINK_X = 0.0
INNER_BBOX_SHRINK_Y = 0.0
INNER_BBOX_DENSE_SHRINK_X = 0.0
INNER_BBOX_DENSE_SHRINK_Y = 0.0
FONT_UNIFY_MODE = "role_min"
SOURCE_CLEANUP_STRATEGY = "pikepdf_text_strip"
SOURCE_CLEANUP_TYPST_FILL = "typst_fill"
SOURCE_CLEANUP_PIKEPDF_TEXT_STRIP = "pikepdf_text_strip"
SOURCE_CLEANUP_BBOX_TEXT_STRIP_ALIASES = {
    SOURCE_CLEANUP_PIKEPDF_TEXT_STRIP,
    "bbox_text_strip",
    "legacy",
}
SOURCE_CLEANUP_STRATEGIES = {
    SOURCE_CLEANUP_TYPST_FILL,
    *SOURCE_CLEANUP_BBOX_TEXT_STRIP_ALIASES,
    "redact_restore_formulas",
}


def apply_layout_tuning(
    *,
    body_font_size_factor: float | None = None,
    body_leading_factor: float | None = None,
    inner_bbox_shrink_x: float | None = None,
    inner_bbox_shrink_y: float | None = None,
    inner_bbox_dense_shrink_x: float | None = None,
    inner_bbox_dense_shrink_y: float | None = None,
    font_unify_mode: str | None = None,
    source_cleanup_strategy: str | None = None,
) -> None:
    global BODY_FONT_SIZE_FACTOR
    global BODY_LEADING_FACTOR
    global INNER_BBOX_SHRINK_X
    global INNER_BBOX_SHRINK_Y
    global INNER_BBOX_DENSE_SHRINK_X
    global INNER_BBOX_DENSE_SHRINK_Y
    global FONT_UNIFY_MODE
    global SOURCE_CLEANUP_STRATEGY

    if body_font_size_factor is not None:
        BODY_FONT_SIZE_FACTOR = body_font_size_factor
    if body_leading_factor is not None:
        BODY_LEADING_FACTOR = body_leading_factor
    if inner_bbox_shrink_x is not None:
        INNER_BBOX_SHRINK_X = inner_bbox_shrink_x
    if inner_bbox_shrink_y is not None:
        INNER_BBOX_SHRINK_Y = inner_bbox_shrink_y
    if inner_bbox_dense_shrink_x is not None:
        INNER_BBOX_DENSE_SHRINK_X = inner_bbox_dense_shrink_x
    if inner_bbox_dense_shrink_y is not None:
        INNER_BBOX_DENSE_SHRINK_Y = inner_bbox_dense_shrink_y
    if font_unify_mode is not None:
        mode = str(font_unify_mode or "").strip().lower()
        FONT_UNIFY_MODE = mode if mode in {"role_min", "off"} else "role_min"
    if source_cleanup_strategy is not None:
        SOURCE_CLEANUP_STRATEGY = normalize_source_cleanup_strategy(source_cleanup_strategy)


def normalize_source_cleanup_strategy(value: str | None) -> str:
    strategy = str(value or "").strip().lower()
    return strategy if strategy in SOURCE_CLEANUP_STRATEGIES else SOURCE_CLEANUP_TYPST_FILL


def use_typst_fill_cleanup() -> bool:
    return SOURCE_CLEANUP_STRATEGY == SOURCE_CLEANUP_TYPST_FILL


def use_bbox_text_strip_cleanup(strategy: str | None = None) -> bool:
    resolved = normalize_source_cleanup_strategy(strategy) if strategy is not None else SOURCE_CLEANUP_STRATEGY
    return resolved in SOURCE_CLEANUP_BBOX_TEXT_STRIP_ALIASES


def use_redact_restore_formula_cleanup(strategy: str | None = None) -> bool:
    resolved = normalize_source_cleanup_strategy(strategy) if strategy is not None else SOURCE_CLEANUP_STRATEGY
    return resolved == "redact_restore_formulas"
