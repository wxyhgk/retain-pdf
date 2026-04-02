from foundation.config.fonts import DEFAULT_FONT_PATH
from foundation.config.fonts import DEFAULT_FONT_SIZE
from foundation.config.fonts import MIN_FONT_SIZE
from foundation.config.fonts import TYPST_DEFAULT_FONT_FAMILY
from foundation.config.layout import BODY_FONT_SIZE_FACTOR
from foundation.config.layout import BODY_LEADING_FACTOR
from foundation.config.layout import INNER_BBOX_DENSE_SHRINK_X
from foundation.config.layout import INNER_BBOX_DENSE_SHRINK_Y
from foundation.config.layout import INNER_BBOX_SHRINK_X
from foundation.config.layout import INNER_BBOX_SHRINK_Y
from foundation.config.layout import apply_layout_tuning as _apply_layout_tuning
from foundation.config.paths import DATA_DIR
from foundation.config.paths import OUTPUT_DIR
from foundation.config.paths import ROOT_DIR
from foundation.config.paths import SOURCE_JSON
from foundation.config.paths import SOURCE_PDF
from foundation.config.paths import TRANSLATION_UNIT_CACHE_DIR
from foundation.config.paths import TRANSLATIONS_DIR
from foundation.config.runtime import DEFAULT_OUTPUT_NAME
from foundation.config.runtime import DEFAULT_PAGE_INDEX
from foundation.config.runtime import DEFAULT_PDF_COMPRESS_DPI


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

    _apply_layout_tuning(
        body_font_size_factor=body_font_size_factor,
        body_leading_factor=body_leading_factor,
        inner_bbox_shrink_x=inner_bbox_shrink_x,
        inner_bbox_shrink_y=inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=inner_bbox_dense_shrink_y,
    )

    from foundation.config import layout as _layout

    BODY_FONT_SIZE_FACTOR = _layout.BODY_FONT_SIZE_FACTOR
    BODY_LEADING_FACTOR = _layout.BODY_LEADING_FACTOR
    INNER_BBOX_SHRINK_X = _layout.INNER_BBOX_SHRINK_X
    INNER_BBOX_SHRINK_Y = _layout.INNER_BBOX_SHRINK_Y
    INNER_BBOX_DENSE_SHRINK_X = _layout.INNER_BBOX_DENSE_SHRINK_X
    INNER_BBOX_DENSE_SHRINK_Y = _layout.INNER_BBOX_DENSE_SHRINK_Y
