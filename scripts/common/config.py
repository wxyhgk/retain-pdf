from config.fonts import DEFAULT_FONT_PATH
from config.fonts import DEFAULT_FONT_SIZE
from config.fonts import MIN_FONT_SIZE
from config.fonts import TYPST_DEFAULT_FONT_FAMILY
from config.layout import BODY_FONT_SIZE_FACTOR
from config.layout import BODY_LEADING_FACTOR
from config.layout import INNER_BBOX_DENSE_SHRINK_X
from config.layout import INNER_BBOX_DENSE_SHRINK_Y
from config.layout import INNER_BBOX_SHRINK_X
from config.layout import INNER_BBOX_SHRINK_Y
from config.layout import apply_layout_tuning as _apply_layout_tuning
from config.paths import DATA_DIR
from config.paths import OUTPUT_DIR
from config.paths import ROOT_DIR
from config.paths import SOURCE_JSON
from config.paths import SOURCE_PDF
from config.paths import TRANSLATION_UNIT_CACHE_DIR
from config.paths import TRANSLATIONS_DIR
from config.runtime import DEFAULT_OUTPUT_NAME
from config.runtime import DEFAULT_PAGE_INDEX
from config.runtime import DEFAULT_PDF_COMPRESS_DPI


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

    from config import layout as _layout

    BODY_FONT_SIZE_FACTOR = _layout.BODY_FONT_SIZE_FACTOR
    BODY_LEADING_FACTOR = _layout.BODY_LEADING_FACTOR
    INNER_BBOX_SHRINK_X = _layout.INNER_BBOX_SHRINK_X
    INNER_BBOX_SHRINK_Y = _layout.INNER_BBOX_SHRINK_Y
    INNER_BBOX_DENSE_SHRINK_X = _layout.INNER_BBOX_DENSE_SHRINK_X
    INNER_BBOX_DENSE_SHRINK_Y = _layout.INNER_BBOX_DENSE_SHRINK_Y
