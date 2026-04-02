BODY_FONT_SIZE_FACTOR = 0.9215
BODY_LEADING_FACTOR = 0.988
INNER_BBOX_SHRINK_X = 0.035
INNER_BBOX_SHRINK_Y = 0.04
INNER_BBOX_DENSE_SHRINK_X = 0.025
INNER_BBOX_DENSE_SHRINK_Y = 0.03


def apply_layout_tuning(
    *,
    body_font_size_factor: float | None = None,
    body_leading_factor: float | None = None,
    inner_bbox_shrink_x: float | None = None,
    inner_bbox_shrink_y: float | None = None,
    inner_bbox_dense_shrink_x: float | None = None,
    inner_bbox_dense_shrink_y: float | None = None,
) -> None:
    global BODY_FONT_SIZE_FACTOR
    global BODY_LEADING_FACTOR
    global INNER_BBOX_SHRINK_X
    global INNER_BBOX_SHRINK_Y
    global INNER_BBOX_DENSE_SHRINK_X
    global INNER_BBOX_DENSE_SHRINK_Y

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
