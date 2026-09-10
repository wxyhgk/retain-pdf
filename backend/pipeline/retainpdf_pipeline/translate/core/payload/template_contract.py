from __future__ import annotations

from pathlib import Path
import re


TRANSLATED_TEXT_FIELDS = (
    "translation_unit_protected_translated_text",
    "translation_unit_translated_text",
    "protected_translated_text",
    "translated_text",
    "group_protected_translated_text",
    "group_translated_text",
)
UNESCAPED_INLINE_DOLLAR_RE = re.compile(r"(?<!\\)\$")
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


def unwrap_json_translated_text(text: str) -> tuple[str, str] | None:
    import json

    raw = str(text or "").strip()
    if not raw.startswith("{") or ("translated_text" not in raw and "translations" not in raw):
        return None
    try:
        payload = json.loads(raw)
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    if "translated_text" in payload:
        decision = str(payload.get("decision", "translate") or "translate").strip() or "translate"
        translated_text = str(payload.get("translated_text", "") or "").strip()
        return decision, translated_text
    translations = payload.get("translations", [])
    if not isinstance(translations, list) or len(translations) != 1 or not isinstance(translations[0], dict):
        return None
    decision = str(translations[0].get("decision", "translate") or "translate").strip() or "translate"
    translated_text = str(translations[0].get("translated_text", "") or "").strip()
    return decision, translated_text


def has_balanced_inline_math_delimiters(text: str) -> bool:
    return len(UNESCAPED_INLINE_DOLLAR_RE.findall(text or "")) % 2 == 0


def sanitize_loaded_translation_record(record: dict) -> bool:
    changed = False
    for field in TRANSLATED_TEXT_FIELDS:
        current = str(record.get(field, "") or "").strip()
        unwrapped = unwrap_json_translated_text(current)
        if unwrapped is None:
            continue
        decision, translated_text = unwrapped
        record[field] = "" if decision == "keep_origin" else translated_text
        changed = True
    if str(record.get("math_mode", "") or "").strip() == "direct_typst":
        translated_text = str(
            record.get("translation_unit_protected_translated_text")
            or record.get("group_protected_translated_text")
            or record.get("protected_translated_text")
            or record.get("translated_text")
            or ""
        ).strip()
        if translated_text and not has_balanced_inline_math_delimiters(translated_text):
            for field in TRANSLATED_TEXT_FIELDS:
                if record.get(field):
                    record[field] = ""
                    changed = True
            if record.get("final_status"):
                record["final_status"] = ""
                changed = True
    return changed


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
