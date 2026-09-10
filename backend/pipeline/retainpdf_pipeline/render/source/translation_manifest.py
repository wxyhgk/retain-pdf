"""Render-local translation-manifest / payload file readers.

Duplicated from:
- retainpdf_pipeline.translate.core.payload.manifest
  (``TRANSLATION_MANIFEST_FILE_NAME``, ``translation_manifest_path``,
  ``load_translation_manifest_file``, ``load_translation_manifest``)
- retainpdf_pipeline.translate.core.payload.translations (``load_translations``)
- retainpdf_pipeline.translate.core.payload.template_contract
  (``validate_translation_payload_contract`` + required contract fields)

(stage-decouple: render must read ``translation-manifest.json`` and page
payload files directly instead of importing translate at runtime.)
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


TRANSLATION_MANIFEST_FILE_NAME = "translation-manifest.json"
TRANSLATION_MANIFEST_SCHEMA = "translation_manifest_v1"
TRANSLATION_MANIFEST_SCHEMA_VERSION = 1

REQUIRED_CONTRACT_FIELDS = (
    "block_kind",
    "layout_role",
    "semantic_role",
    "structure_role",
    "policy_translate",
    "asset_id",
    "reading_order",
    "raw_block_type",
    "normalized_sub_type",
)


def translation_manifest_path(translations_dir: Path) -> Path:
    return translations_dir / TRANSLATION_MANIFEST_FILE_NAME


def load_translation_manifest_file(manifest_path: Path, *, translations_dir: Path | None = None) -> dict[int, Path]:
    manifest_path = Path(manifest_path)
    base_dir = Path(translations_dir) if translations_dir is not None else manifest_path.parent
    resolved_base_dir = base_dir.resolve()

    with manifest_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    schema = str(payload.get("schema", "") or "")
    if schema != TRANSLATION_MANIFEST_SCHEMA:
        raise RuntimeError(f"Unsupported translation manifest schema: {schema or '<missing>'}")

    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise RuntimeError(f"Invalid translation manifest pages: {manifest_path}")

    translation_paths: dict[int, Path] = {}
    for page in pages:
        if not isinstance(page, dict):
            raise RuntimeError(f"Invalid translation manifest page entry: {manifest_path}")
        page_index = int(page.get("page_index"))
        raw_path = str(page.get("path", "") or "").strip()
        if not raw_path:
            raise RuntimeError(f"Translation manifest page {page_index} is missing path")
        translation_path = Path(raw_path)
        if translation_path.is_absolute():
            raise RuntimeError(
                f"Translation manifest page {page_index} uses absolute payload path: {raw_path}"
            )
        translation_path = base_dir / translation_path
        try:
            translation_path.resolve().relative_to(resolved_base_dir)
        except ValueError as exc:
            raise RuntimeError(
                f"Translation manifest page {page_index} payload path escapes translations_dir: {raw_path}"
            ) from exc
        if page_index in translation_paths:
            raise RuntimeError(f"Duplicate translation manifest page index: {page_index}")
        translation_paths[page_index] = translation_path
    return translation_paths


def load_translation_manifest(translations_dir: Path) -> dict[int, Path]:
    manifest_path = translation_manifest_path(translations_dir)
    return load_translation_manifest_file(manifest_path, translations_dir=translations_dir)


def missing_contract_fields(record: dict) -> list[str]:
    missing: list[str] = []
    for key in REQUIRED_CONTRACT_FIELDS:
        if key not in record:
            missing.append(key)
    return missing


def validate_translation_payload_contract(payload: list[dict], *, translation_path: Path) -> None:
    for index, record in enumerate(payload):
        if not isinstance(record, dict):
            raise RuntimeError(f"invalid translation payload at {translation_path}: record[{index}] is not an object")
        missing = missing_contract_fields(record)
        if missing:
            item_id = str(record.get("item_id", "") or f"record[{index}]")
            missing_joined = ", ".join(missing)
            raise RuntimeError(
                f"invalid translation payload at {translation_path}: {item_id} missing strict contract fields: {missing_joined}"
            )


def load_translations(
    translation_path: Path, *, strict_contract: bool = True, expected_sha256: str | None = None,
) -> list[dict]:
    """Read a translation payload without modifying either data or disk state."""

    raw = translation_path.read_bytes()
    if expected_sha256 is not None and hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise RuntimeError(f"Committed translation page hash mismatch: {translation_path}")
    payload = json.loads(raw.decode("utf-8"))
    if strict_contract:
        validate_translation_payload_contract(payload, translation_path=translation_path)
    return payload


__all__ = [
    "REQUIRED_CONTRACT_FIELDS",
    "TRANSLATION_MANIFEST_FILE_NAME",
    "TRANSLATION_MANIFEST_SCHEMA",
    "TRANSLATION_MANIFEST_SCHEMA_VERSION",
    "load_translation_manifest",
    "load_translation_manifest_file",
    "load_translations",
    "missing_contract_fields",
    "translation_manifest_path",
    "validate_translation_payload_contract",
]
