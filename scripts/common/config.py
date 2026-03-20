from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "en2zh" / "Data"
OUTPUT_DIR = ROOT_DIR / "output"
TRANSLATIONS_DIR = OUTPUT_DIR / "translations"

SOURCE_PDF = DATA_DIR / "std2_manual.pdf"
SOURCE_JSON = DATA_DIR / "std2_manual.json"

DEFAULT_FONT_PATH = Path("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf")
DEFAULT_FONT_SIZE = 11.5
MIN_FONT_SIZE = 8.5
DEFAULT_PAGE_INDEX = 0
DEFAULT_OUTPUT_NAME = "dev-1.pdf"
