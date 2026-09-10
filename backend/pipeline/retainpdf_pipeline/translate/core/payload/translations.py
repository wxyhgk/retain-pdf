from __future__ import annotations
import json
import os
import tempfile
from pathlib import Path

from retainpdf_pipeline.translate.core.ocr.models import TextItem
from retainpdf_pipeline.translate.core.payload.parts.translation_units import refresh_payload_translation_units

from .template_contract import sanitize_loaded_translation_record
from .template_contract import validate_translation_payload_contract
from .template_records import build_translation_record
from .template_sync import append_missing_translation_records
from .template_sync import sync_translation_record


def _atomic_write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
        text=True,
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
        _fsync_parent_dir(path)
    except Exception:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
        raise


def _fsync_parent_dir(path: Path) -> None:
    try:
        dir_fd = os.open(path.parent, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


def export_translation_template(
    items: list[TextItem],
    output_path: Path,
    page_idx: int,
    *,
    math_mode: str = "placeholder",
) -> None:
    del page_idx
    payload = [build_translation_record(item, math_mode=math_mode) for item in items]
    _atomic_write_json(output_path, payload)


def load_translations(translation_path: Path, *, strict_contract: bool = True) -> list[dict]:
    """Read a translation payload without modifying either data or disk state."""

    with translation_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    if strict_contract:
        validate_translation_payload_contract(payload, translation_path=translation_path)
    return payload


def migrate_translations(translation_path: Path, *, strict_contract: bool = True) -> list[dict]:
    """Explicitly normalize a persisted payload and atomically save any changes."""

    with translation_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    changed = False
    for record in payload:
        if isinstance(record, dict):
            changed = sanitize_loaded_translation_record(record) or changed
    if refresh_payload_translation_units(payload, preserve_external_groups=True):
        changed = True
    if strict_contract:
        validate_translation_payload_contract(payload, translation_path=translation_path)
    if changed:
        save_translations(translation_path, payload)
    return payload


def save_translations(translation_path: Path, payload: list[dict]) -> None:
    _atomic_write_json(translation_path, payload)


def ensure_translation_template(
    items: list[TextItem],
    output_path: Path,
    page_idx: int,
    *,
    math_mode: str = "placeholder",
) -> Path:
    if not output_path.exists():
        output_path.parent.mkdir(parents=True, exist_ok=True)
        export_translation_template(items, output_path, page_idx=page_idx, math_mode=math_mode)
        return output_path

    try:
        payload = migrate_translations(output_path)
    except json.JSONDecodeError:
        export_translation_template(items, output_path, page_idx=page_idx, math_mode=math_mode)
        return output_path
    except RuntimeError as exc:
        if "missing strict contract fields" not in str(exc):
            raise
        export_translation_template(items, output_path, page_idx=page_idx, math_mode=math_mode)
        return output_path
    item_map = {item.item_id: item for item in items}
    item_ids = set(item_map)
    changed = False
    pruned_payload = [
        record
        for record in payload
        if isinstance(record, dict) and str(record.get("item_id", "") or "") in item_ids
    ]
    if len(pruned_payload) != len(payload):
        payload = pruned_payload
        changed = True
    existing_item_ids = {
        str(record.get("item_id", "") or "")
        for record in payload
    }
    for record in payload:
        item = item_map.get(record.get("item_id"))
        if not item:
            continue
        changed = sync_translation_record(record, item, math_mode=math_mode) or changed
    changed = append_missing_translation_records(
        payload,
        items=items,
        existing_item_ids=existing_item_ids,
        math_mode=math_mode,
    ) or changed
    if refresh_payload_translation_units(payload):
        changed = True
    if changed:
        save_translations(output_path, payload)
    return output_path
