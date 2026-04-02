import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[3]
ROOT_DIR = BACKEND_ROOT.parent if BACKEND_ROOT.name == "backend" else BACKEND_ROOT
DATA_DIR = ROOT_DIR / "en2zh" / "Data"


def _path_from_env(*names: str, default: Path) -> Path:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return Path(value).expanduser()
    return default


OUTPUT_DIR = _path_from_env("OUTPUT_ROOT", "RUST_API_OUTPUT_ROOT", default=ROOT_DIR / "data")
TRANSLATIONS_DIR = OUTPUT_DIR / "translations"
TRANSLATION_UNIT_CACHE_DIR = OUTPUT_DIR / "_translation_unit_cache"

SOURCE_PDF = DATA_DIR / "std2_manual.pdf"
SOURCE_JSON = DATA_DIR / "std2_manual.json"
