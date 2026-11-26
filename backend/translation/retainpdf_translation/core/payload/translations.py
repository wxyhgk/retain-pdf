from __future__ import annotations
import json
from pathlib import Path

from retainpdf_base.io import save_json_atomic
from retainpdf_translation.core.ocr.models import TextItem
from retainpdf_translation.core.payload.parts.translation_units import refresh_payload_translation_units

from .template_contract import loaded_translation_suspects
from .template_contract import validate_translation_payload_contract
from .template_records import build_translation_record
from .template_sync import append_missing_translation_records
from .template_sync import sync_translation_record


def export_translation_template(
    items: list[TextItem],
    output_path: Path,
    page_idx: int,
    *,
    math_mode: str = "direct_typst",
) -> None:
    del page_idx
    payload = [build_translation_record(item, math_mode=math_mode) for item in items]
    save_json_atomic(output_path, payload)


def load_translations(translation_path: Path, *, strict_contract: bool = True) -> list[dict]:
    """Read a translation payload without modifying either data or disk state."""

    with translation_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    if strict_contract:
        validate_translation_payload_contract(payload, translation_path=translation_path)
    return payload


def migrate_translations(translation_path: Path, *, strict_contract: bool = True) -> list[dict]:
    """Explicitly normalize a persisted payload and atomically save any changes.

    只整理翻译单元（接续组），不动已有译文：可疑译文（`$` 不成对、JSON 壳）只打一行日志（S02、T-N11）。"""

    with translation_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    changed = False
    _log_suspect_translations(translation_path, payload)
    if refresh_payload_translation_units(payload, preserve_external_groups=True):
        changed = True
    if strict_contract:
        validate_translation_payload_contract(payload, translation_path=translation_path)
    if changed:
        save_translations(translation_path, payload)
    return payload


def _log_suspect_translations(translation_path: Path, payload: object) -> None:
    if not isinstance(payload, list):
        return
    suspects = [
        f"{record.get('item_id', '')}({','.join(kinds)})"
        for record in payload
        if isinstance(record, dict) and (kinds := loaded_translation_suspects(record))
    ]
    if suspects:
        preview = ", ".join(suspects[:8]) + (f" … (+{len(suspects) - 8})" if len(suspects) > 8 else "")
        print(f"translation load: {translation_path.name} keeps {len(suspects)} suspect translations as is: {preview}", flush=True)


def save_translations(translation_path: Path, payload: list[dict]) -> None:
    save_json_atomic(translation_path, payload)


def ensure_translation_template(
    items: list[TextItem],
    output_path: Path,
    page_idx: int,
    *,
    math_mode: str = "direct_typst",
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
    # 这里只有一页：跨页接续组在这一页只有一个成员，不带 preserve_external_groups 会被降成单块、清掉组层译文并写回磁盘，
    # 之后整本刷新只补回组号（2026-11-26，S23）。和开头 migrate_translations 一样保留跨页组。
    if refresh_payload_translation_units(payload, preserve_external_groups=True):
        changed = True
    if changed:
        save_translations(output_path, payload)
    return output_path
