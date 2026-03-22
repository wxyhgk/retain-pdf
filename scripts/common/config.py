from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "en2zh" / "Data"
OUTPUT_DIR = ROOT_DIR / "output"
TRANSLATIONS_DIR = OUTPUT_DIR / "translations"
TRANSLATION_UNIT_CACHE_DIR = OUTPUT_DIR / "_translation_unit_cache"

SOURCE_PDF = DATA_DIR / "std2_manual.pdf"
SOURCE_JSON = DATA_DIR / "std2_manual.json"

DEFAULT_FONT_PATH = Path("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf")
DEFAULT_FONT_SIZE = 11.5
MIN_FONT_SIZE = 8.5
DEFAULT_PAGE_INDEX = 0
DEFAULT_OUTPUT_NAME = "dev-1.pdf"
TYPST_DEFAULT_FONT_FAMILY = "Noto Serif CJK SC"
DEFAULT_PDF_COMPRESS_DPI = 200
BODY_FONT_SIZE_FACTOR = 0.95
BODY_LEADING_FACTOR = 1.08
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
