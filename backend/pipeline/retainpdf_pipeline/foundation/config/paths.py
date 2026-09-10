import os
from pathlib import Path


PROJECT_ROOT_ENV_NAMES = ("RETAIN_PDF_PROJECT_ROOT", "RUST_API_PROJECT_ROOT")


def _project_root() -> Path:
    for name in PROJECT_ROOT_ENV_NAMES:
        value = os.environ.get(name, "").strip()
        if value:
            return Path(value).expanduser().resolve()

    file_path = Path(__file__).resolve()
    for parent in file_path.parents:
        if (parent / "backend" / "pipeline").is_dir() and (parent / "contracts").is_dir():
            return parent
        if (parent / ".git").exists():
            return parent
    # An installed package has no repository root. Keep the default anchored
    # to the caller's working directory; production callers set OUTPUT_ROOT.
    return Path.cwd().resolve()


ROOT_DIR = _project_root()
BACKEND_ROOT = ROOT_DIR / "backend"
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
DOMAIN_CONTEXT_CACHE_DIR = OUTPUT_DIR / "_domain_context_cache"
RENDER_TYPOGRAPHY_MEMORY_DIR = OUTPUT_DIR / "_render_typography_memory"

SOURCE_PDF = DATA_DIR / "std2_manual.pdf"
SOURCE_JSON = DATA_DIR / "std2_manual.json"
