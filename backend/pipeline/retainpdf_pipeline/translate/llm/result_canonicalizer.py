from __future__ import annotations

from retainpdf_pipeline.services.pipeline_shared.direct_typst_math import normalize_direct_typst_translation
from retainpdf_pipeline.translate.llm.placeholder_transform import repair_safe_duplicate_placeholders
from retainpdf_pipeline.translate.llm.result_payload import KEEP_ORIGIN_LABEL
from retainpdf_pipeline.translate.llm.result_payload import normalize_decision
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.shared.response_parsing import unwrap_translation_shell
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text


def canonicalize_batch_result(batch: list[dict], result: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    batch_items = {str(item.get("item_id", "") or ""): item for item in batch}
    canonical: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        item = batch_items.get(item_id)
        decision = normalize_decision(str(payload.get("decision", "translate") or "translate"))
        translated_text = unwrap_translation_shell(str(payload.get("translated_text", "") or "").strip(), item_id=item_id)
        if item is not None:
            source_text = unit_source_text(item).strip()
            if decision != KEEP_ORIGIN_LABEL and translated_text:
                repaired_text = repair_safe_duplicate_placeholders(source_text, translated_text)
                if repaired_text is not None:
                    translated_text = repaired_text
            if (
                decision != KEEP_ORIGIN_LABEL
                and translated_text
                and translated_text == source_text
                and not should_force_translate_body_text(item)
            ):
                decision = KEEP_ORIGIN_LABEL
                translated_text = ""
            # direct_typst 的机械格式规整放在 keep_origin 判定之后:规整会改动
            # 文本,先做会破坏 translated_text == source_text 的原样检测。
            if decision != KEEP_ORIGIN_LABEL and translated_text and is_direct_math_mode(item):
                translated_text = normalize_direct_typst_translation(translated_text)
        canonical[item_id] = result_entry(decision, translated_text)
        if isinstance(payload, dict) and payload.get("final_status"):
            canonical[item_id]["final_status"] = str(payload.get("final_status", "") or canonical[item_id]["final_status"])
        if isinstance(payload, dict) and isinstance(payload.get("member_translations"), list):
            canonical[item_id]["member_translations"] = payload["member_translations"]
    return canonical


__all__ = ["canonicalize_batch_result"]
