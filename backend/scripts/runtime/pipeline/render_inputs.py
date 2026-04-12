from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from services.translation.payload import TRANSLATION_MANIFEST_FILE_NAME


RENDER_INPUT_ERROR_PREFIX = "Render-only input error"


@dataclass(frozen=True)
class RenderInputs:
    source_pdf_path: Path
    translations_dir: Path
    translation_manifest_path: Path | None


def _ensure_existing_file(path: Path, *, label: str) -> Path:
    if not path.exists():
        raise RuntimeError(f"{RENDER_INPUT_ERROR_PREFIX}: {label} not found: {path}")
    if not path.is_file():
        raise RuntimeError(f"{RENDER_INPUT_ERROR_PREFIX}: {label} is not a file: {path}")
    return path


def _ensure_existing_dir(path: Path, *, label: str) -> Path:
    if not path.exists():
        raise RuntimeError(f"{RENDER_INPUT_ERROR_PREFIX}: {label} not found: {path}")
    if not path.is_dir():
        raise RuntimeError(f"{RENDER_INPUT_ERROR_PREFIX}: {label} is not a directory: {path}")
    return path


def resolve_render_inputs(
    *,
    source_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
) -> RenderInputs:
    resolved_source_pdf_path = _ensure_existing_file(Path(source_pdf_path), label="source PDF")

    resolved_manifest_path: Path | None = None
    resolved_translations_dir: Path | None = None

    if translation_manifest_path is not None:
        resolved_manifest_path = _ensure_existing_file(Path(translation_manifest_path), label="translation manifest")
        resolved_translations_dir = resolved_manifest_path.parent

    if translations_dir is not None:
        candidate_dir = _ensure_existing_dir(Path(translations_dir), label="translations dir")
        if resolved_translations_dir is not None and candidate_dir.resolve() != resolved_translations_dir.resolve():
            raise RuntimeError(
                f"{RENDER_INPUT_ERROR_PREFIX}: translations_dir and translation_manifest_path point to different directories"
            )
        resolved_translations_dir = candidate_dir

    if resolved_translations_dir is None:
        raise RuntimeError(
            f"{RENDER_INPUT_ERROR_PREFIX}: provide translations_dir or translation_manifest_path together with source PDF"
        )

    if resolved_manifest_path is None:
        candidate_manifest_path = resolved_translations_dir / TRANSLATION_MANIFEST_FILE_NAME
        if candidate_manifest_path.exists():
            resolved_manifest_path = _ensure_existing_file(
                candidate_manifest_path,
                label=TRANSLATION_MANIFEST_FILE_NAME,
            )

    if resolved_manifest_path is None:
        legacy_payload_paths = list(resolved_translations_dir.glob("page-*-deepseek.json"))
        if not legacy_payload_paths:
            raise RuntimeError(
                f"{RENDER_INPUT_ERROR_PREFIX}: no {TRANSLATION_MANIFEST_FILE_NAME} or legacy page-*-deepseek.json found in {resolved_translations_dir}"
            )

    return RenderInputs(
        source_pdf_path=resolved_source_pdf_path,
        translations_dir=resolved_translations_dir,
        translation_manifest_path=resolved_manifest_path,
    )
