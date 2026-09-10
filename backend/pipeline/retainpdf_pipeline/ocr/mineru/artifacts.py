from __future__ import annotations

"""Filesystem/path helpers for MinerU job artifacts.

This module owns where raw MinerU files and normalized OCR files live on disk.
It does not parse or normalize `layout.json` itself.
"""

import os
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.assets import (
    normalize_mineru_image_path,
)
from retainpdf_pipeline.ocr.document_schema.version import (
    DOCUMENT_SCHEMA_FILE_NAME,
    DOCUMENT_SCHEMA_REPORT_FILE_NAME,
)
from retainpdf_pipeline.ocr.mineru.contracts import (
    MINERU_BUNDLE_FILE_NAME,
    MINERU_LAYOUT_JSON_FILE_NAME,
    MINERU_NORMALIZED_DIR_NAME,
    MINERU_RESULT_FILE_NAME,
    MINERU_UNPACK_DIR_NAME,
)
from retainpdf_pipeline.ocr.mineru.mineru_api import request_mineru
from retainpdf_pipeline.services.pipeline_shared.io import save_json
from retainpdf_pipeline.ocr.source_json import (
    resolve_preferred_source_json_path,
    resolve_translation_source_json_path,
)


@dataclass(frozen=True)
class MinerUArtifactPaths:
    ocr_dir: Path
    result_json_path: Path
    bundle_zip_path: Path
    unpack_dir: Path
    normalized_json_path: Path
    normalized_report_json_path: Path

    @property
    def layout_json_path(self) -> Path:
        return self.unpack_dir / MINERU_LAYOUT_JSON_FILE_NAME


def build_mineru_artifact_paths(ocr_dir: Path) -> MinerUArtifactPaths:
    """Own the on-disk MinerU artifact layout for one job.

    This module is the single place that knows where raw bundle files,
    unpacked raw OCR files, and normalized OCR files live on disk.
    """
    return MinerUArtifactPaths(
        ocr_dir=ocr_dir,
        result_json_path=ocr_dir / MINERU_RESULT_FILE_NAME,
        bundle_zip_path=ocr_dir / MINERU_BUNDLE_FILE_NAME,
        unpack_dir=ocr_dir / MINERU_UNPACK_DIR_NAME,
        normalized_json_path=ocr_dir
        / MINERU_NORMALIZED_DIR_NAME
        / DOCUMENT_SCHEMA_FILE_NAME,
        normalized_report_json_path=ocr_dir
        / MINERU_NORMALIZED_DIR_NAME
        / DOCUMENT_SCHEMA_REPORT_FILE_NAME,
    )


def download_file(url: str, path: Path, headers: dict[str, str] | None = None) -> None:
    with request_mineru(
        "get", url, headers=headers, stream=True, timeout=300
    ) as response:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)


# The MinerU bundle is downloaded from a cloud provider (or a presigned CDN
# URL derived from it). CPython's zipfile already blocks path traversal on
# extractall, but it will happily inflate an arbitrarily large payload onto
# the shared job disk -- a malformed or hostile bundle (huge files, or a zip
# bomb with a small archive but enormous declared uncompressed size) can fill
# it. Guard on both total declared uncompressed size and entry count before
# extracting anything.
MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES_ENV = "RETAIN_MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES"
MINERU_BUNDLE_MAX_ENTRIES_ENV = "RETAIN_MINERU_BUNDLE_MAX_ENTRIES"
_DEFAULT_MAX_UNCOMPRESSED_BYTES = (
    4 * 1024 * 1024 * 1024
)  # 4 GiB: OCR bundles with page images can be large.
_DEFAULT_MAX_ENTRIES = 50_000


def _bundle_max_uncompressed_bytes() -> int:
    raw = os.environ.get(MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES_ENV, "").strip()
    try:
        value = int(raw) if raw else _DEFAULT_MAX_UNCOMPRESSED_BYTES
    except ValueError:
        value = _DEFAULT_MAX_UNCOMPRESSED_BYTES
    return max(1, value)


def _bundle_max_entries() -> int:
    raw = os.environ.get(MINERU_BUNDLE_MAX_ENTRIES_ENV, "").strip()
    try:
        value = int(raw) if raw else _DEFAULT_MAX_ENTRIES
    except ValueError:
        value = _DEFAULT_MAX_ENTRIES
    return max(1, value)


def ensure_zip_within_limits(zf: zipfile.ZipFile, *, zip_path: Path) -> None:
    """Reject a zip bundle whose declared entry count or uncompressed size is absurd.

    Must run before extractall(); it only inspects the (trusted-format)
    central directory, never inflates anything itself.
    """
    max_entries = _bundle_max_entries()
    max_uncompressed_bytes = _bundle_max_uncompressed_bytes()
    infos = zf.infolist()
    if len(infos) > max_entries:
        raise RuntimeError(
            f"MinerU bundle rejected: {len(infos)} entries exceeds limit of {max_entries} "
            f"(zip={zip_path}); set {MINERU_BUNDLE_MAX_ENTRIES_ENV} to override."
        )
    total_uncompressed_bytes = sum(info.file_size for info in infos)
    if total_uncompressed_bytes > max_uncompressed_bytes:
        raise RuntimeError(
            f"MinerU bundle rejected: declared uncompressed size {total_uncompressed_bytes} bytes exceeds "
            f"limit of {max_uncompressed_bytes} bytes (zip={zip_path}); "
            f"set {MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES_ENV} to override."
        )


def unpack_zip(zip_path: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        ensure_zip_within_limits(zf, zip_path=zip_path)
        zf.extractall(dest_dir)


def download_and_unpack_bundle(
    *,
    full_zip_url: str,
    zip_path: Path,
    unpack_dir: Path,
    headers: dict[str, str] | None = None,
) -> None:
    # full_zip_url is a presigned CDN/object-store URL and must not carry the
    # MinerU API bearer token (callers should not pass headers here).
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
        raise RuntimeError(
            "MinerU unpacked bundle does not contain *_origin.pdf for remote input."
        )
    resolved_source_pdf_path = origin_pdf_dir / unpacked_origin.name
    shutil.copy2(unpacked_origin, resolved_source_pdf_path)
    return resolved_source_pdf_path


def resolve_layout_json_path(unpack_dir: Path) -> Path:
    layout_json_path = unpack_dir / MINERU_LAYOUT_JSON_FILE_NAME
    if layout_json_path.is_file():
        return layout_json_path

    # MinerU's current public output names this file
    # ``{original_filename}_middle.json``. Older RetainPDF bundles used the
    # canonical ``layout.json`` name, so accept both at the transport edge and
    # let normalize_pipeline materialize the canonical copy.
    candidates = sorted(
        {
            *unpack_dir.rglob("*_middle.json"),
            *unpack_dir.rglob("middle.json"),
        }
    )
    candidates = [candidate for candidate in candidates if candidate.is_file()]
    if len(candidates) == 1:
        return candidates[0]
    if len(candidates) > 1:
        joined = ", ".join(str(candidate) for candidate in candidates[:8])
        raise RuntimeError(
            "MinerU bundle contains multiple middle.json candidates; "
            f"cannot choose the authoritative layout input: {joined}"
        )
    raise RuntimeError(
        "MinerU middle/layout JSON not found after unpack: "
        f"expected {layout_json_path} or a single *_middle.json under {unpack_dir}"
    )


def _find_mineru_image_source(
    *,
    provider_raw_dir: Path,
    layout_json_path: Path,
    relative_path: str,
) -> Path | None:
    raw_root = provider_raw_dir.resolve()

    def is_safe_file(candidate: Path) -> bool:
        try:
            candidate.resolve().relative_to(raw_root)
        except (OSError, ValueError):
            return False
        return candidate.is_file()

    direct_candidates = (
        layout_json_path.parent / "images" / relative_path,
        provider_raw_dir / "images" / relative_path,
    )
    for candidate in direct_candidates:
        if is_safe_file(candidate):
            return candidate

    suffix = Path("images") / Path(relative_path)
    matches = [
        candidate
        for candidate in provider_raw_dir.rglob(Path(relative_path).name)
        if is_safe_file(candidate)
        and len(candidate.parts) >= len(suffix.parts)
        and candidate.parts[-len(suffix.parts) :] == suffix.parts
    ]
    return matches[0] if len(matches) == 1 else None


def _hardlink_or_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    try:
        os.link(source, target)
    except OSError:
        temp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=target.parent,
                prefix=f".{target.name}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temp_path = Path(handle.name)
            shutil.copy2(source, temp_path)
            os.replace(temp_path, target)
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)


def materialize_mineru_page_assets(
    *,
    document: dict,
    provider_raw_dir: Path,
    layout_json_path: Path,
    markdown_images_dir: Path,
) -> dict[str, int]:
    """Expose MinerU bundle images through Reader's page-scoped asset root."""

    requested: set[tuple[int, str]] = set()
    resolved: set[tuple[int, str]] = set()
    source_cache: dict[str, Path | None] = {}

    for fallback_page_index, page in enumerate(document.get("pages", []) or []):
        raw_page_index = page.get("page_index")
        page_index = (
            int(raw_page_index)
            if raw_page_index is not None
            else fallback_page_index
        )
        for block in page.get("blocks", []) or []:
            metadata = block.get("metadata", {}) or {}
            raw_paths = metadata.get("provider_image_paths", [])
            if (
                not raw_paths
                and str(metadata.get("asset_kind", "") or "") == "markdown_image"
            ):
                raw_paths = metadata.get("asset_paths", [])
            if not isinstance(raw_paths, list):
                continue
            block_requested: list[str] = []
            block_resolved = 0
            for raw_path in raw_paths:
                relative = normalize_mineru_image_path(raw_path)
                if not relative:
                    continue
                block_requested.append(relative)
                key = (page_index, relative)
                requested.add(key)
                if relative not in source_cache:
                    source_cache[relative] = _find_mineru_image_source(
                        provider_raw_dir=provider_raw_dir,
                        layout_json_path=layout_json_path,
                        relative_path=relative,
                    )
                source = source_cache[relative]
                if source is None:
                    continue
                target = markdown_images_dir / f"page-{page_index + 1}" / relative
                _hardlink_or_copy(source, target)
                resolved.add(key)
                block_resolved += 1
            if block_requested:
                metadata["asset_resolved_count"] = block_resolved
                metadata["asset_resolved"] = block_resolved == len(block_requested)

    signals = document.setdefault("derived", {}).setdefault("provider_signals", {})
    signals["bundle_image_reference_count"] = len(requested)
    signals["materialized_page_asset_count"] = len(resolved)
    signals["missing_page_asset_count"] = len(requested - resolved)
    return {
        "requested": len(requested),
        "materialized": len(resolved),
        "missing": len(requested - resolved),
    }


def resolve_normalized_json_path(ocr_dir: Path) -> Path:
    return ocr_dir / MINERU_NORMALIZED_DIR_NAME / DOCUMENT_SCHEMA_FILE_NAME


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


__all__ = [
    "MINERU_BUNDLE_MAX_ENTRIES_ENV",
    "MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES_ENV",
    "MinerUArtifactPaths",
    "build_mineru_artifact_paths",
    "download_and_unpack_bundle",
    "download_file",
    "ensure_source_pdf_from_bundle",
    "ensure_zip_within_limits",
    "materialize_mineru_page_assets",
    "resolve_layout_json_path",
    "resolve_normalized_json_path",
    "resolve_preferred_source_json_path",
    "resolve_translation_source_from_artifacts",
    "resolve_translation_source_json_path",
    "save_json",
    "unpack_zip",
]
