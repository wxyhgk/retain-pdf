from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "en2zh" / "Data"
OUTPUT_DIR = ROOT_DIR / "output"
TRANSLATIONS_DIR = OUTPUT_DIR / "translations"
TRANSLATION_UNIT_CACHE_DIR = OUTPUT_DIR / "_translation_unit_cache"

SOURCE_PDF = DATA_DIR / "std2_manual.pdf"
SOURCE_JSON = DATA_DIR / "std2_manual.json"

