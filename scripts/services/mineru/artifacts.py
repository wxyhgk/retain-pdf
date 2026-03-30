from __future__ import annotations

"""Filesystem/path helpers for MinerU job artifacts.

This module owns where raw MinerU files and normalized OCR files live on disk.
It does not parse or normalize `layout.json` itself.
"""

import json
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path

import requests

from services.document_schema.version import DOCUMENT_SCHEMA_FILE_NAME


@dataclass(frozen=True)
class MinerUArtifactPaths:
    ocr_dir: Path
    result_json_path: Path
    bundle_zip_path: Path
    unpack_dir: Path
    normalized_json_path: Path

    @property
    def layout_json_path(self) -> Path:
        return self.unpack_dir / "layout.json"


def build_mineru_artifact_paths(ocr_dir: Path) -> MinerUArtifactPaths:
    """Own the on-disk MinerU artifact layout for one job.

    This module is the single place that knows where raw bundle files,
    unpacked raw OCR files, and normalized OCR files live on disk.
    """
    return MinerUArtifactPaths(
        ocr_dir=ocr_dir,
        result_json_path=ocr_dir / "mineru_result.json",
        bundle_zip_path=ocr_dir / "mineru_bundle.zip",
        unpack_dir=ocr_dir / "unpacked",
        normalized_json_path=ocr_dir / "normalized" / DOCUMENT_SCHEMA_FILE_NAME,
    )


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def download_file(url: str, path: Path, headers: dict[str, str] | None = None) -> None:
    with requests.get(url, headers=headers, stream=True, timeout=300) as response:
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)


def unpack_zip(zip_path: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)


def download_and_unpack_bundle(
    *,
    full_zip_url: str,
    zip_path: Path,
    unpack_dir: Path,
    headers: dict[str, str],
) -> None:
    download_file(full_zip_url, zip_path, headers=headers)
    unpack_zip(zip_path, unpack_dir)


def ensure_source_pdf_from_bundle(
    *,
    unpack_dir: Path,
    origin_pdf_dir: Path,
    source_pdf_path: Path | None,
) -> Path:
    if source_pdf_path is not None:
        return source_pdf_path
    unpacked_origin = next(unpack_dir.glob("*_origin.pdf"), None)
    if unpacked_origin is None:
        raise RuntimeError("MinerU unpacked bundle does not contain *_origin.pdf for remote input.")
    resolved_source_pdf_path = origin_pdf_dir / unpacked_origin.name
    shutil.copy2(unpacked_origin, resolved_source_pdf_path)
    return resolved_source_pdf_path


def resolve_layout_json_path(unpack_dir: Path) -> Path:
    layout_json_path = unpack_dir / "layout.json"
    if not layout_json_path.exists():
        raise RuntimeError(f"layout.json not found after unpack: {layout_json_path}")
    return layout_json_path


def resolve_normalized_json_path(ocr_dir: Path) -> Path:
    return ocr_dir / "normalized" / DOCUMENT_SCHEMA_FILE_NAME


def resolve_translation_source_from_artifacts(
    artifact_paths: MinerUArtifactPaths,
    *,
    allow_layout_fallback: bool = False,
) -> Path:
    return resolve_translation_source_json_path(
        layout_json_path=artifact_paths.layout_json_path,
        normalized_json_path=artifact_paths.normalized_json_path,
        allow_layout_fallback=allow_layout_fallback,
    )


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
                "Neither normalized OCR JSON nor raw MinerU layout.json exists. "
                f"normalized={normalized_json_path} layout={layout_json_path}"
            )
        print(
            "warning: normalized OCR JSON is missing; falling back to raw MinerU layout.json "
            f"because allow_layout_fallback=True. normalized={normalized_json_path} layout={layout_json_path}",
            flush=True,
        )
        return layout_json_path

    raw_state = "exists" if layout_json_path.exists() else "missing"
    raise RuntimeError(
        "Normalized OCR JSON is required for the translation/rendering mainline, but it is missing. "
        f"normalized={normalized_json_path} raw_layout={layout_json_path} raw_layout_state={raw_state}. "
        "The raw layout.json is kept only for adapter/debug use; it is no longer used as an implicit fallback."
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


__all__ = [
    "MinerUArtifactPaths",
    "build_mineru_artifact_paths",
    "download_and_unpack_bundle",
    "download_file",
    "ensure_source_pdf_from_bundle",
    "resolve_layout_json_path",
    "resolve_normalized_json_path",
    "resolve_translation_source_from_artifacts",
    "resolve_preferred_source_json_path",
    "resolve_translation_source_json_path",
    "save_json",
    "unpack_zip",
]
