import os
from pathlib import Path

BACKEND_FONTS_DIR = Path(__file__).resolve().parents[3] / "fonts"

DEFAULT_FONT_PATH = Path(
    os.environ.get("RETAIN_PDF_FONT_PATH", "").strip()
    or "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
)
TITLE_BOLD_FONT_PATH = Path(
    os.environ.get("RETAIN_PDF_TITLE_BOLD_FONT_PATH", "").strip()
    or str(BACKEND_FONTS_DIR / "SourceHanSerifSC-Bold.otf")
)
DEFAULT_FONT_SIZE = 11.4
MIN_FONT_SIZE = 8.5
TYPST_DEFAULT_FONT_FAMILY = os.environ.get("RETAIN_PDF_TYPST_FONT_FAMILY", "").strip() or "Source Han Serif SC"
