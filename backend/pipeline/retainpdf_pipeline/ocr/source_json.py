from __future__ import annotations

from pathlib import Path


def resolve_translation_source_json_path(
    *,
    layout_json_path: Path,
    normalized_json_path: Path,
    allow_layout_fallback: bool = False,
) -> Path:
    if normalized_json_path.exists():
        return normalized_json_path
    if allow_layout_fallback:
        if not layout_json_path.exists():
            raise RuntimeError(
                "Neither normalized OCR JSON nor raw provider layout JSON exists. "
                f"normalized={normalized_json_path} layout={layout_json_path}"
            )
        print(
            "warning: normalized OCR JSON is missing; falling back to raw provider layout JSON "
            f"because allow_layout_fallback=True. normalized={normalized_json_path} layout={layout_json_path}",
            flush=True,
        )
        return layout_json_path

    raw_state = "exists" if layout_json_path.exists() else "missing"
    raise RuntimeError(
        "Normalized OCR JSON is required for the translation/rendering mainline, but it is missing. "
        f"normalized={normalized_json_path} raw_layout={layout_json_path} raw_layout_state={raw_state}. "
        "The raw provider layout is kept only for adapter/debug use; it is no longer used as an implicit fallback."
    )


def resolve_preferred_source_json_path(
    *,
    layout_json_path: Path,
    normalized_json_path: Path,
    allow_layout_fallback: bool = False,
) -> Path:
    return resolve_translation_source_json_path(
        layout_json_path=layout_json_path,
        normalized_json_path=normalized_json_path,
        allow_layout_fallback=allow_layout_fallback,
    )
