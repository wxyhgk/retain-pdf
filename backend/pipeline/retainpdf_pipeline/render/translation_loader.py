from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.source.translation_manifest import load_translations
from retainpdf_pipeline.render.source.translation_manifest import load_translation_manifest
from retainpdf_pipeline.render.source.translation_manifest import load_translation_manifest_file
from retainpdf_pipeline.render.source.translation_manifest import translation_manifest_path


def _checkpoint_bytes(path: Path) -> bytes | None:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None


def _committed_page_hashes(raw: bytes | None, *, manifest_path: Path,
                           translation_paths: dict[int, Path], translations_dir: Path) -> dict[int, str]:
    # Historical standalone manifests have no checkpoint and remain readable.
    if raw is None:
        return {}
    try:
        checkpoint = json.loads(raw)
        if (checkpoint.get("schema") != "translation_checkpoint_v1"
                or checkpoint.get("schema_version") != 1
                or checkpoint.get("status") != "complete"
                or checkpoint.get("phase") != "committed"
                or checkpoint.get("progress", {}).get("pending_item_count") != 0
                or checkpoint.get("final_manifest") != manifest_path.name):
            raise ValueError("checkpoint is not a committed publication")
        pages = checkpoint["pages"]
        if not isinstance(pages, list):
            raise ValueError("checkpoint pages must be a list")
        hashes = {}
        for page in pages:
            index = page["page_index"]
            expected_path = translation_paths.get(index)
            relative = Path(page["path"])
            if (index in hashes or expected_path is None or relative.is_absolute()
                    or len(relative.parts) != 1
                    or (translations_dir / relative).resolve() != expected_path.resolve()):
                raise ValueError("checkpoint and manifest page paths differ")
            digest = page["page_hash"]
            if (not isinstance(digest, str) or len(digest) != 64
                    or any(char not in "0123456789abcdef" for char in digest)):
                raise ValueError("checkpoint page hash is missing or invalid")
            hashes[index] = digest
        if hashes.keys() != translation_paths.keys():
            raise ValueError("checkpoint and manifest page sets differ")
        return hashes
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise RuntimeError(f"Translation publication is not committed or consistent: {manifest_path}") from exc


def load_translated_pages(
    translations_dir: Path,
    *,
    manifest_path: Path | None = None,
) -> dict[int, list[dict]]:
    translated_pages: dict[int, list[dict]] = {}
    checkpoint_path = translations_dir / "translation-checkpoint.v1.json"
    checkpoint_before = _checkpoint_bytes(checkpoint_path)
    resolved_manifest_path = manifest_path if manifest_path is not None else translation_manifest_path(translations_dir)
    if not resolved_manifest_path.exists():
        raise RuntimeError(f"Translation manifest not found: {resolved_manifest_path}")
    manifest_before = resolved_manifest_path.read_bytes()
    translation_paths = (
        load_translation_manifest_file(resolved_manifest_path, translations_dir=translations_dir)
        if manifest_path is not None
        else load_translation_manifest(translations_dir)
    )
    page_hashes = _committed_page_hashes(
        checkpoint_before, manifest_path=resolved_manifest_path,
        translation_paths=translation_paths, translations_dir=translations_dir,
    )
    for page_idx, path in sorted(translation_paths.items()):
        if not path.exists():
            raise RuntimeError(f"Translation manifest entry points to missing file: {path}")
        translated_pages[page_idx] = load_translations(path, expected_sha256=page_hashes.get(page_idx))
    if not translated_pages:
        raise RuntimeError(f"No translation pages listed in {resolved_manifest_path}")
    if (_checkpoint_bytes(checkpoint_path) != checkpoint_before
            or resolved_manifest_path.read_bytes() != manifest_before):
        raise RuntimeError("Translation publication changed while reading; retry after commit")
    return translated_pages


def select_translated_pages(
    translated_pages: dict[int, list[dict]],
    *,
    start_page: int,
    end_page: int,
) -> dict[int, list[dict]]:
    start = max(0, start_page)
    stop = max(translated_pages) if end_page < 0 else end_page
    selected_pages = {
        page_idx: items
        for page_idx, items in translated_pages.items()
        if start <= page_idx <= stop
    }
    if not selected_pages:
        raise RuntimeError(f"No translated pages selected in range {start}..{stop}")
    return selected_pages
