from __future__ import annotations

from pathlib import Path

from retainpdf_math.spans import has_balanced_inline_math_delimiters
from retainpdf_translation.core.payload.parts.result_entries import unwrap_json_translated_text


TRANSLATED_TEXT_FIELDS = (
    "translation_unit_protected_translated_text",
    "translation_unit_translated_text",
    "protected_translated_text",
    "translated_text",
    "group_protected_translated_text",
    "group_translated_text",
)
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


def loaded_translation_suspects(record: dict) -> list[str]:
    """读页时看出来的可疑译文：`json_shell`（译文字段是模型的 JSON 壳）、`math_delimiter_unbalanced`（`$` 不成对）。

    只看不改（2026-11-26，S02、T-N11）：以前这里清空 6 个译文字段并写回磁盘，`$` 数法又不排除行内代码，
    `` `echo $HOME` `` 这种 agent 校验放过的译文也被抹掉，块变回待办、断点报 regressed；JSON 壳里 keep_origin 的只清了译文、
    `final_status` 还是 translated。写入时（`normalize_result_entry`）早就解壳，校验也拦 `$` 不成对，盘上有的只会是老版本留下的，
    不需要迁移。以后由续跑的调和步骤标 `quality=suspect`、低优先级重翻（状态管理设计第 2 步）。"""
    suspects: list[str] = []
    if any(unwrap_json_translated_text(str(record.get(field, "") or "")) is not None for field in TRANSLATED_TEXT_FIELDS):
        suspects.append("json_shell")
    if str(record.get("math_mode", "") or "").strip() == "direct_typst":
        translated_text = str(
            record.get("translation_unit_protected_translated_text")
            or record.get("group_protected_translated_text")
            or record.get("protected_translated_text")
            or record.get("translated_text")
            or ""
        ).strip()
        if translated_text and not has_balanced_inline_math_delimiters(translated_text):
            suspects.append("math_delimiter_unbalanced")
    return suspects


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
