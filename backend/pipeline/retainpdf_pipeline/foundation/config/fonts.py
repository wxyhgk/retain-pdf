import os
import re
import shutil
import subprocess
from pathlib import Path

# --- Backend font dirs: configurable via RETAIN_PDF_FONTS_DIR (comma-separated) ---


def _default_fonts_dir() -> Path:
    for env_name in ("RETAIN_PDF_PROJECT_ROOT", "RUST_API_PROJECT_ROOT"):
        value = os.environ.get(env_name, "").strip()
        if value:
            root = Path(value).expanduser().resolve()
            for candidate in (
                root / "resources" / "fonts",
                root / "fonts",
                root / "services" / "fonts",
                root / "infra" / "fonts",
            ):
                if candidate.is_dir():
                    return candidate
            return root / "fonts"
    for parent in Path(__file__).resolve().parents:
        for candidate in (
            parent / "resources" / "fonts",
            parent / "fonts",
            parent / "services" / "fonts",
            parent / "infra" / "fonts",
        ):
            if candidate.is_dir():
                return candidate
    return Path.cwd().resolve() / "fonts"


_DEFAULT_FONTS_DIR = _default_fonts_dir()


def _parse_font_dirs() -> list[Path]:
    raw = os.environ.get("RETAIN_PDF_FONTS_DIR", "").strip()
    dirs: list[Path] = []
    if raw:
        # Support comma, semicolon and os.pathsep (":" on posix, ";" on windows)
        normalized = raw.replace(os.pathsep, ",").replace(";", ",")
        for part in normalized.split(","):
            part = part.strip()
            if part:
                dirs.append(Path(part).expanduser())
    if not dirs:
        dirs.append(_DEFAULT_FONTS_DIR)
    else:
        # Always keep the bundled backend fonts as a final fallback.
        if _DEFAULT_FONTS_DIR not in dirs:
            dirs.append(_DEFAULT_FONTS_DIR)
    # Deduplicate preserving order
    seen: set[Path] = set()
    uniq: list[Path] = []
    for d in dirs:
        # Use resolved string for dedup to avoid duplicate with different relative forms? Keep simple Path equality
        if d not in seen:
            seen.add(d)
            uniq.append(d)
    return uniq


BACKEND_FONTS_DIRS: list[Path] = _parse_font_dirs()
BACKEND_FONTS_DIR: Path = BACKEND_FONTS_DIRS[0]

DEFAULT_FONT_PATH = Path(
    os.environ.get("RETAIN_PDF_FONT_PATH", "").strip()
    or "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
)
TITLE_BOLD_FONT_PATH = Path(
    os.environ.get("RETAIN_PDF_TITLE_BOLD_FONT_PATH", "").strip()
    or str(BACKEND_FONTS_DIR / "SourceHanSerifSC-Bold.otf")
)
# Allow override for regular weight as well (used by some debug paths)
TITLE_REGULAR_FONT_PATH = Path(
    os.environ.get("RETAIN_PDF_TITLE_REGULAR_FONT_PATH", "").strip()
    or str(BACKEND_FONTS_DIR / "SourceHanSerifSC-Regular.otf")
)
DEFAULT_FONT_SIZE = 11.4
MIN_FONT_SIZE = 8.5
TYPST_DEFAULT_FONT_FAMILY = os.environ.get("RETAIN_PDF_TYPST_FONT_FAMILY", "").strip() or "Source Han Serif SC"


# ---------------------------------------------------------------------------
# Font family discovery
# ---------------------------------------------------------------------------

_FONT_EXTS = {".otf", ".ttf", ".ttc", ".otc", ".woff", ".woff2"}

_STYLE_SUFFIXES = re.compile(r"-(Bold|Regular|Medium|Light|Heavy|ExtraLight|SemiBold|Black|Thin|ExtraBold)$", re.IGNORECASE)


def _family_from_filename(path: Path) -> str:
    stem = path.stem
    # Strip style suffix
    stem = _STYLE_SUFFIXES.sub("", stem)
    # Known mapping for bundled CJK font
    if "SourceHanSerifSC" in stem or "SourceHanSerif" in stem:
        return "Source Han Serif SC"
    if "SourceHanSansSC" in stem or "SourceHanSans" in stem:
        return "Source Han Sans SC"
    # Generic fallback: insert spaces before capital letters (CamelCase -> words)
    # e.g. NotoSerifSC -> Noto Serif SC (heuristic)
    # Keep stem as-is if contains spaces already
    if " " in stem:
        return stem
    # Simple heuristic: replace underscores/hyphens with spaces
    cleaned = re.sub(r"[_-]+", " ", stem)
    return cleaned.strip() or stem


def _family_from_file(path: Path) -> str | None:
    # Prefer fc-query / fc-scan if available (most accurate, respects name table)
    for bin_name in ("fc-query", "fc-scan"):
        bin_path = shutil.which(bin_name)
        if not bin_path:
            continue
        try:
            # fc-query --format %{family[0]}\n FILE
            # fc-scan  --format %{family[0]}\n FILE
            result = subprocess.run(
                [bin_path, "--format", "%{family[0]}\n", str(path)],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0:
                family = result.stdout.strip().splitlines()[0].strip() if result.stdout.strip() else ""
                # fc-query may return comma-separated families
                if family:
                    # Take first family before comma
                    family = family.split(",")[0].strip()
                    if family:
                        return family
        except Exception:
            continue

    # Try fontTools if installed
    try:
        from fontTools.ttLib import TTFont  # type: ignore

        try:
            font = TTFont(str(path), fontNumber=0, lazy=True)  # type: ignore
            # nameID 1 = Family, 16 = Typographic Family
            name_table = font["name"]  # type: ignore
            for name_id in (16, 1):
                for record in name_table.names:  # type: ignore
                    if record.nameID == name_id:
                        try:
                            value = record.toUnicode().strip()  # type: ignore
                            if value:
                                font.close()
                                return value
                        except Exception:
                            continue
            font.close()
        except Exception:
            pass
    except ImportError:
        pass

    return None


def _font_dirs_to_scan(extra_dirs: list[Path] | None = None) -> list[Path]:
    dirs = list(BACKEND_FONTS_DIRS)
    # Also include RETAIN_PDF_TYPST_FONT_DIRS (os.pathsep-separated) for completeness
    typst_raw = os.environ.get("RETAIN_PDF_TYPST_FONT_DIRS", "").strip()
    if typst_raw:
        normalized = typst_raw.replace(",", os.pathsep)
        for part in normalized.split(os.pathsep):
            part = part.strip()
            if part:
                p = Path(part).expanduser()
                if p not in dirs:
                    dirs.append(p)
    if extra_dirs:
        for p in extra_dirs:
            if p not in dirs:
                dirs.append(p)
    return dirs


def listFontFamilies(extra_dirs: list[Path] | None = None) -> list[dict]:
    """
    Scan font dirs via fc-list heuristic + filesystem walk.

    Returns:
        list of {"family": str, "files": [str], "available": bool}
        Sorted by family name. Guarantees Source Han Serif SC appears if its files exist.
    """
    dirs = _font_dirs_to_scan(extra_dirs)
    family_to_files: dict[str, list[str]] = {}

    # Strategy 1: fc-list with file/family for system fonts within our dirs
    # Filesystem scan remains authoritative because bundled fonts may not be in fontconfig cache.
    fc_list = shutil.which("fc-list")
    if fc_list:
        try:
            result = subprocess.run(
                [fc_list, "-f", "%{family[0]}:%{file}\n"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout:
                for line in result.stdout.splitlines():
                    line = line.strip()
                    if not line or ":" not in line:
                        continue
                    family_part, file_part = line.split(":", 1)
                    family = family_part.split(",")[0].strip()
                    file_path = file_part.strip()
                    if not family or not file_path:
                        continue
                    # Only include files that are under our font dirs (or all if we want broader)
                    # For verification we want at least Source Han Serif SC, so also accept any file
                    # but we'll filter to known dirs to avoid huge list; include matching files
                    try:
                        fp = Path(file_path)
                        # Include if file is under any of our dirs
                        for d in dirs:
                            try:
                                # Use string prefix check for robustness even if dir doesn't exist
                                if str(fp).startswith(str(d)):
                                    family_to_files.setdefault(family, []).append(str(fp))
                                    break
                            except Exception:
                                continue
                    except Exception:
                        continue
        except Exception:
            pass

    # Strategy 2: filesystem scan (authoritative for bundled fonts)
    for d in dirs:
        if not d.exists() or not d.is_dir():
            continue
        for file_path in d.rglob("*"):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in _FONT_EXTS:
                continue
            family = _family_from_file(file_path)
            if not family:
                family = _family_from_filename(file_path)
            family = family.strip()
            if not family:
                continue
            files = family_to_files.setdefault(family, [])
            fp_str = str(file_path)
            if fp_str not in files:
                files.append(fp_str)

    # Build result
    result_list: list[dict] = []
    for family, files in sorted(family_to_files.items()):
        files_sorted = sorted(set(files))
        available = any(Path(f).exists() for f in files_sorted)
        result_list.append({"family": family, "files": files_sorted, "available": available})

    # Ensure Source Han Serif SC appears if its files exist (defensive: filesystem scan should have added it)
    if not any(item["family"] == "Source Han Serif SC" for item in result_list):
        # Check if any SourceHanSerifSC file exists in dirs
        candidate_files: list[str] = []
        for d in dirs:
            for name in ("SourceHanSerifSC-Bold.otf", "SourceHanSerifSC-Regular.otf"):
                p = d / name
                if p.exists():
                    candidate_files.append(str(p))
        if candidate_files:
            result_list.append({"family": "Source Han Serif SC", "files": sorted(candidate_files), "available": True})
            result_list.sort(key=lambda x: x["family"])

    return result_list


# snake_case alias for Pythonic callers / tests
def list_font_families(extra_dirs: list[Path] | None = None) -> list[dict]:
    return listFontFamilies(extra_dirs)
