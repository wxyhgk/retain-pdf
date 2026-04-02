from pathlib import Path


def _pick_single_file(input_dir: Path, suffix: str) -> Path:
    candidates = sorted(path for path in input_dir.iterdir() if path.is_file() and path.suffix.lower() == suffix)
    if not candidates:
        raise RuntimeError(f"No {suffix} file found in {input_dir}")
    if len(candidates) > 1:
        names = ", ".join(path.name for path in candidates)
        raise RuntimeError(f"Expected exactly one {suffix} file in {input_dir}, found: {names}")
    return candidates[0]


def resolve_case_sources(input_dir: Path) -> tuple[Path, Path, str]:
    if not input_dir.exists() or not input_dir.is_dir():
        raise RuntimeError(f"Input directory does not exist: {input_dir}")
    source_json = _pick_single_file(input_dir, ".json")
    source_pdf = _pick_single_file(input_dir, ".pdf")
    stem = source_pdf.stem or source_json.stem or input_dir.name
    return source_json, source_pdf, stem
