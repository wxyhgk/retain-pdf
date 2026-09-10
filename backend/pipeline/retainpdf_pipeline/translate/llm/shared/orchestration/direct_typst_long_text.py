from __future__ import annotations

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.core.item_reader import item_content_kind
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode
from retainpdf_pipeline.translate.llm.shared.orchestration.common import chunk_source_text_fallback
from retainpdf_pipeline.translate.llm.shared.orchestration.common import SENTENCE_SPLIT_RE
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import formula_route_diagnostics
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads


DIRECT_TYPTST_LONG_TEXT_MAX_CHARS = 4000
DIRECT_TYPTST_LONG_TEXT_TARGET_CHARS = 2200


def should_split_direct_typst_long_text(item: dict) -> bool:
    if not is_direct_math_mode(item):
        return False
    if item.get("_direct_typst_long_split_applied"):
        return False
    if item_content_kind(item) != "text":
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    compact = " ".join(source_text.split())
    return len(compact) > DIRECT_TYPTST_LONG_TEXT_MAX_CHARS


def split_direct_typst_long_text(source_text: str) -> list[str]:
    sentences = [part.strip() for part in SENTENCE_SPLIT_RE.split(source_text) if part.strip()]
    if len(sentences) <= 1:
        return chunk_source_text_fallback(source_text, words_per_chunk=120)
    chunks: list[str] = []
    current: list[str] = []
    current_chars = 0
    for sentence in sentences:
        sentence_chars = len(sentence)
        if current and current_chars + sentence_chars > DIRECT_TYPTST_LONG_TEXT_TARGET_CHARS:
            chunks.append(" ".join(current).strip())
            current = []
            current_chars = 0
        current.append(sentence)
        current_chars += sentence_chars + 1
    if current:
        chunks.append(" ".join(current).strip())
    return [chunk for chunk in chunks if chunk.strip()]


def translate_direct_typst_long_text_chunks(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    translator,
) -> dict[str, dict[str, str]] | None:
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    chunks = split_direct_typst_long_text(source_text)
    if len(chunks) <= 1:
        return None

    translated_parts: list[str] = []
    degraded_chunks = 0
    degraded_indices: list[int] = []
    for index, chunk in enumerate(chunks):
        chunk_item = dict(item)
        chunk_item["_direct_typst_long_split_applied"] = True
        chunk_item["translation_unit_protected_source_text"] = chunk
        chunk_item["protected_source_text"] = chunk
        chunk_item["continuation_prev_text"] = chunks[index - 1] if index > 0 else ""
        chunk_item["continuation_next_text"] = chunks[index + 1] if index < len(chunks) - 1 else ""
        try:
            chunk_result = translator(
                chunk_item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} long#{index + 1}" if request_label else "",
                context=context,
                diagnostics=diagnostics,
            )
            payload = chunk_result.get(item["item_id"], {})
            translated = str(payload.get("translated_text", "") or "").strip()
            if str(payload.get("decision", "translate") or "translate") == "keep_origin":
                translated = ""
        except Exception:
            translated = ""
        if not translated:
            degraded_chunks += 1
            degraded_indices.append(index)
            if request_label:
                print(
                    f"{request_label} long#{index + 1}: long direct_typst chunk failed",
                    flush=True,
                )
        translated_parts.append(translated)

    if degraded_chunks >= len(chunks):
        # 全部块失败才整体判失败;个别块失败走下方的部分接受。
        result = terminal_payloads.translation_failed_payload_for_validation(
            item,
            context=context,
            route_path=["block_level", "direct_typst", "long_text_split", "failed"],
            degradation_reason="direct_typst_long_text_split_chunk_failed",
            error_code="CHUNK_TRANSLATION_FAILED",
        )
        payload = result[item["item_id"]]
        payload["translation_diagnostics"]["segment_stats"] = {
            "expected": len(chunks),
            "received": len(chunks) - degraded_chunks,
            "missing_ids": [str(index + 1) for index, part in enumerate(translated_parts) if not part],
        }
        payload["translation_diagnostics"]["degraded_chunk_count"] = degraded_chunks
        return result

    if degraded_chunks:
        # 部分接受:失败块降级为原文保留(与公式窗口路径一致),
        # 不再因一个块的瞬时失败作废整条 4000+ 字符的大块。
        translated_parts = [
            part if part else chunks[index]
            for index, part in enumerate(translated_parts)
        ]
        if request_label:
            print(
                f"{request_label}: long direct_typst partial accept, {degraded_chunks}/{len(chunks)} chunks kept as source",
                flush=True,
            )

    payload = result_entry("translate", " ".join(part for part in translated_parts if part).strip())
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "direct_typst", "long_text_split"],
        "output_mode_path": ["plain_text"],
        "fallback_to": "",
        "degradation_reason": (
            "direct_typst_long_text_split_partial" if degraded_chunks else "direct_typst_long_text_split"
        ),
        "final_status": "partially_translated" if degraded_chunks else "translated",
        "segment_stats": {
            "expected": len(chunks),
            "received": len(chunks) - degraded_chunks,
            "missing_ids": [str(index + 1) for index in degraded_indices],
        },
        "degraded_chunk_count": degraded_chunks,
        **formula_route_diagnostics(item, context=context),
    }
    return {item["item_id"]: payload}
