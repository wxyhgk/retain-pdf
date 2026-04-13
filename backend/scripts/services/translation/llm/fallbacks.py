from __future__ import annotations

import json
import re
import time

from services.document_schema.semantics import is_body_structure_role
from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.payload.formula_protection import restore_tokens_by_type
from services.translation.policy.metadata_filter import looks_like_hard_nontranslatable_metadata
from services.translation.llm.cache import split_cached_batch
from services.translation.llm.cache import store_cached_batch
from services.translation.llm.control_context import TranslationControlContext
from services.translation.llm.placeholder_guard import PlaceholderInventoryError
from services.translation.llm.placeholder_guard import EmptyTranslationError
from services.translation.llm.placeholder_guard import EnglishResidueError
from services.translation.llm.placeholder_guard import SuspiciousKeepOriginError
from services.translation.llm.placeholder_guard import TranslationProtocolError
from services.translation.llm.placeholder_guard import UnexpectedPlaceholderError
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import has_formula_placeholders
from services.translation.llm.placeholder_guard import internal_keep_origin_result
from services.translation.llm.placeholder_guard import is_internal_placeholder_degraded
from services.translation.llm.placeholder_guard import item_with_runtime_hard_glossary
from services.translation.llm.placeholder_guard import item_with_placeholder_aliases
from services.translation.llm.placeholder_guard import log_placeholder_failure
from services.translation.llm.placeholder_guard import placeholder_alias_maps
from services.translation.llm.placeholder_guard import placeholder_sequence
from services.translation.llm.placeholder_guard import placeholder_stability_guidance
from services.translation.llm.placeholder_guard import restore_placeholder_aliases
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import should_force_translate_body_text
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.segment_routing import formula_segment_translation_route
from services.translation.llm.segment_routing import small_formula_risk_score
from services.translation.llm.segment_routing import build_formula_segment_plan
from services.translation.llm.segment_routing import effective_formula_segment_count
from services.translation.llm.segment_routing import formula_segment_window_count
from services.translation.llm.segment_routing import translate_single_item_formula_segment_text_with_retries
from services.translation.llm.segment_routing import translate_single_item_formula_segment_windows_with_retries
from services.translation.llm.translation_client import translate_batch_once
from services.translation.llm.translation_client import translate_single_item_plain_text
from services.translation.llm.translation_client import translate_single_item_plain_text_unstructured
from services.translation.llm.translation_client import translate_single_item_tagged_text


SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;:])\s+")
WORD_SPLIT_RE = re.compile(r"\S+")
FORMULA_PLACEHOLDER_RE = re.compile(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")
HEAVY_FORMULA_SPLIT_PLACEHOLDERS = 16
HEAVY_FORMULA_SPLIT_SEGMENTS = 16
HEAVY_FORMULA_SPLIT_WINDOWS = 3
HEAVY_FORMULA_CHUNK_PLACEHOLDERS = 8
HEAVY_FORMULA_CHUNK_CHARS = 900


def _formula_density(source_text: str, placeholder_count: int) -> float:
    if not source_text or placeholder_count <= 0:
        return 0.0
    return round(placeholder_count / max(1, len(source_text)), 4)


def _formula_route_diagnostics(
    item: dict,
    *,
    context: TranslationControlContext | None = None,
) -> dict[str, object]:
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    placeholder_count = _formula_placeholder_count(source_text)
    diagnostics: dict[str, object] = {}
    group_split_reason = str(item.get("group_split_reason", "") or "").strip()
    if group_split_reason:
        diagnostics["group_split_reason"] = group_split_reason
    if placeholder_count <= 0:
        return diagnostics
    policy = context.segmentation_policy if context is not None else None
    _, segments = build_formula_segment_plan(source_text)
    diagnostics.update(
        {
            "formula_placeholder_count": placeholder_count,
            "formula_segment_count": len(segments),
            "effective_formula_segment_count": effective_formula_segment_count(segments),
            "formula_window_count": formula_segment_window_count(item, policy=policy),
            "formula_density": _formula_density(source_text, placeholder_count),
            "formula_route_decision": formula_segment_translation_route(item, policy=policy),
            "small_formula_risk_score": small_formula_risk_score(
                source_text,
                segments=segments,
                policy=policy,
            ),
        }
    )
    if item.get("_heavy_formula_split_applied"):
        diagnostics["heavy_block_split_applied"] = True
    return diagnostics


def _chunk_source_text_fallback(source_text: str, *, words_per_chunk: int = 48) -> list[str]:
    words = WORD_SPLIT_RE.findall(source_text or "")
    if len(words) <= words_per_chunk:
        return [str(source_text or "").strip()] if str(source_text or "").strip() else []
    return [" ".join(words[i : i + words_per_chunk]).strip() for i in range(0, len(words), words_per_chunk)]


def _restore_runtime_term_tokens(
    result: dict[str, dict[str, str]],
    *,
    item: dict,
) -> dict[str, dict[str, str]]:
    protected_map = list(item.get("translation_unit_protected_map") or item.get("protected_map") or [])
    if not protected_map:
        return result
    restored: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        next_payload = dict(payload)
        next_payload["translated_text"] = restore_tokens_by_type(
            str(payload.get("translated_text", "") or ""),
            protected_map,
            {"term"},
        )
        restored[item_id] = next_payload
    return restored


def _should_store_translation_result(payload: dict[str, str]) -> bool:
    if not payload:
        return False
    if is_internal_placeholder_degraded(payload):
        return False
    final_status = str(payload.get("final_status", "") or "").strip().lower()
    if final_status and final_status != "translated":
        return False
    diagnostics = payload.get("translation_diagnostics")
    if isinstance(diagnostics, dict):
        fallback_to = str(diagnostics.get("fallback_to", "") or "").strip().lower()
        if fallback_to == "sentence_level":
            return False
    return True


def _formula_placeholder_count(text: str) -> int:
    return len(FORMULA_PLACEHOLDER_RE.findall(text or ""))


def _heavy_formula_split_reason(item: dict, *, context: TranslationControlContext) -> str:
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    placeholder_count = _formula_placeholder_count(source_text)
    if placeholder_count < HEAVY_FORMULA_SPLIT_PLACEHOLDERS:
        return ""
    _, segments = build_formula_segment_plan(source_text)
    effective_segments = effective_formula_segment_count(segments)
    if effective_segments >= HEAVY_FORMULA_SPLIT_SEGMENTS:
        return "heavy_formula_segment_count"
    if formula_segment_window_count(item, policy=context.segmentation_policy) >= HEAVY_FORMULA_SPLIT_WINDOWS:
        return "heavy_formula_window_count"
    return ""


def _split_heavy_formula_block(source_text: str) -> list[str]:
    sentences = [part.strip() for part in SENTENCE_SPLIT_RE.split(source_text) if part.strip()]
    if len(sentences) <= 1:
        sentences = _chunk_source_text_fallback(source_text, words_per_chunk=40)
    if len(sentences) <= 1:
        return [str(source_text or "").strip()] if str(source_text or "").strip() else []

    chunks: list[str] = []
    current: list[str] = []
    current_placeholders = 0
    current_chars = 0
    for sentence in sentences:
        sentence_placeholders = _formula_placeholder_count(sentence)
        sentence_chars = len(sentence)
        would_overflow = bool(current) and (
            current_placeholders + sentence_placeholders > HEAVY_FORMULA_CHUNK_PLACEHOLDERS
            or current_chars + sentence_chars > HEAVY_FORMULA_CHUNK_CHARS
        )
        if would_overflow:
            chunks.append(" ".join(current).strip())
            current = []
            current_placeholders = 0
            current_chars = 0
        current.append(sentence)
        current_placeholders += sentence_placeholders
        current_chars += sentence_chars

    if current:
        chunks.append(" ".join(current).strip())
    return [chunk for chunk in chunks if chunk.strip()]


def _translate_heavy_formula_block(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    split_reason: str,
) -> dict[str, dict[str, str]] | None:
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    chunks = _split_heavy_formula_block(source_text)
    if len(chunks) <= 1:
        return None

    translated_parts: list[str] = []
    for index, chunk in enumerate(chunks):
        chunk_item = dict(item)
        chunk_item["_heavy_formula_split_applied"] = True
        chunk_item["translation_unit_protected_source_text"] = chunk
        chunk_item["protected_source_text"] = chunk
        chunk_item["continuation_prev_text"] = chunks[index - 1] if index > 0 else str(item.get("continuation_prev_text", "") or "")
        chunk_item["continuation_next_text"] = chunks[index + 1] if index < len(chunks) - 1 else str(item.get("continuation_next_text", "") or "")
        chunk_result = translate_single_item_plain_text_with_retries(
            chunk_item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=f"{request_label} split#{index + 1}" if request_label else "",
            context=context,
            diagnostics=diagnostics,
        )
        translated = str(chunk_result.get(item["item_id"], {}).get("translated_text", "") or "").strip()
        if not translated:
            raise EmptyTranslationError(str(item.get("item_id", "") or ""))
        translated_parts.append(translated)

    payload = result_entry("translate", " ".join(translated_parts).strip())
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "heavy_formula_split"],
        "output_mode_path": ["plain_text"],
        "fallback_to": "",
        "degradation_reason": split_reason,
        "final_status": "translated",
        "segment_stats": {
            "expected": len(chunks),
            "received": len(chunks),
            "missing_ids": [],
        },
        **_formula_route_diagnostics(item, context=context),
    }
    return {item["item_id"]: payload}


def _attach_result_metadata(
    result: dict[str, dict[str, str]],
    *,
    item: dict,
    context: TranslationControlContext | None = None,
    route_path: list[str],
    output_mode_path: list[str] | None = None,
    error_taxonomy: str = "",
    fallback_to: str = "",
    degradation_reason: str = "",
) -> dict[str, dict[str, str]]:
    enriched: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        next_payload = dict(payload)
        diagnostics = dict(next_payload.get("translation_diagnostics") or {})
        diagnostics.setdefault("item_id", item.get("item_id", item_id))
        diagnostics.setdefault("page_idx", item.get("page_idx"))
        diagnostics["route_path"] = route_path
        diagnostics["output_mode_path"] = output_mode_path or []
        diagnostics["fallback_to"] = fallback_to
        diagnostics["degradation_reason"] = degradation_reason
        diagnostics["final_status"] = next_payload.get("final_status", "translated")
        diagnostics.update(_formula_route_diagnostics(item, context=context))
        if error_taxonomy:
            diagnostics["error_trace"] = [{"type": error_taxonomy}]
        next_payload["translation_diagnostics"] = diagnostics
        enriched[item_id] = next_payload
    return enriched


def _should_keep_origin_on_empty_translation(item: dict) -> bool:
    if looks_like_hard_nontranslatable_metadata(item):
        return True
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    compact = " ".join(source_text.split())
    if not compact or len(compact) > 4:
        return False
    if not compact.replace(" ", "").isalnum():
        return False
    block_type = str(item.get("block_type", "") or "").strip().lower()
    metadata = item.get("metadata", {}) or {}
    structure_role = str(metadata.get("structure_role", "") or "").strip().lower()
    layout_zone = str(item.get("layout_zone", "") or "").strip().lower()
    if block_type in {"image_caption", "table_caption", "table_footnote"}:
        return True
    return structure_role in {"caption", "image_caption", "table_caption", "metadata"} and layout_zone == "non_flow"


def _keep_origin_payload_for_empty_translation(item: dict) -> dict[str, dict[str, str]]:
    payload = internal_keep_origin_result("empty_translation_non_body_label")
    payload["error_taxonomy"] = "validation"
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "keep_origin"],
        "error_trace": [{"type": "validation", "code": "EMPTY_TRANSLATION"}],
        "fallback_to": "keep_origin",
        "degradation_reason": "empty_translation_non_body_label",
        "final_status": "kept_origin",
        **_formula_route_diagnostics(item),
    }
    return {str(item.get("item_id", "") or ""): payload}


def _keep_origin_payload_for_repeated_empty_translation(item: dict) -> dict[str, dict[str, str]]:
    payload = internal_keep_origin_result("empty_translation_repeated")
    payload["error_taxonomy"] = "validation"
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "keep_origin"],
        "error_trace": [{"type": "validation", "code": "EMPTY_TRANSLATION"}],
        "fallback_to": "keep_origin",
        "degradation_reason": "empty_translation_repeated",
        "final_status": "kept_origin",
        **_formula_route_diagnostics(item),
    }
    return {str(item.get("item_id", "") or ""): payload}


def _sentence_level_fallback(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
) -> dict[str, dict[str, str]]:
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    sentences = [part.strip() for part in SENTENCE_SPLIT_RE.split(source_text) if part.strip()]
    if len(sentences) <= 1:
        sentences = _chunk_source_text_fallback(source_text)
    if len(sentences) <= 1:
        raise EmptyTranslationError(str(item.get("item_id", "") or ""))
    translated_parts: list[str] = []
    failed_indexes: list[int] = []
    translated_indexes: list[int] = []
    for index, sentence in enumerate(sentences):
        sentence_item = dict(item)
        sentence_item["translation_unit_protected_source_text"] = sentence
        sentence_item["protected_source_text"] = sentence
        try:
            sentence_result = translate_single_item_plain_text(
                sentence_item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} sent#{index + 1}" if request_label else "",
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
                timeout_s=context.timeout_policy.plain_text_seconds,
            )
            sentence_result = _restore_runtime_term_tokens(sentence_result, item=item)
            translated = str(sentence_result.get(item["item_id"], {}).get("translated_text", "") or "").strip()
            if translated:
                translated_parts.append(translated)
                translated_indexes.append(index)
                continue
        except EmptyTranslationError:
            try:
                sentence_result = translate_single_item_plain_text_unstructured(
                    sentence_item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=f"{request_label} sent#{index + 1} raw" if request_label else "",
                    domain_guidance=context.merged_guidance,
                    mode=context.mode,
                    diagnostics=diagnostics,
                    timeout_s=context.timeout_policy.plain_text_seconds,
                )
                translated = str(sentence_result.get(item["item_id"], {}).get("translated_text", "") or "").strip()
                if translated:
                    translated_parts.append(translated)
                    translated_indexes.append(index)
                    continue
            except Exception:
                pass
        except EnglishResidueError:
            try:
                sentence_result = translate_single_item_plain_text_unstructured(
                    sentence_item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=f"{request_label} sent#{index + 1} raw" if request_label else "",
                    domain_guidance=context.merged_guidance,
                    mode=context.mode,
                    diagnostics=diagnostics,
                    timeout_s=context.timeout_policy.plain_text_seconds,
                )
                translated = str(sentence_result.get(item["item_id"], {}).get("translated_text", "") or "").strip()
                if translated:
                    translated_parts.append(translated)
                    translated_indexes.append(index)
                    continue
            except Exception:
                pass
        except Exception:
            pass
        translated_parts.append(sentence)
        failed_indexes.append(index)
    if not translated_indexes:
        raise PlaceholderInventoryError(
            str(item.get("item_id", "") or ""),
            placeholder_sequence(source_text),
            [],
            source_text=source_text,
            translated_text="",
        )
    payload = result_entry("translate", " ".join(translated_parts).strip())
    payload["final_status"] = "partially_translated"
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "sentence_level"],
        "error_trace": [{"type": "validation", "code": "SENTENCE_FALLBACK"}],
        "fallback_to": "sentence_level",
        "degradation_reason": "validation_failed_sentence_level_fallback",
        "final_status": "partially_translated",
        "segment_stats": {
            "expected": len(sentences),
            "received": len(translated_indexes),
            "missing_ids": [str(index + 1) for index in failed_indexes],
        },
        "latency_ms": 0,
        **_formula_route_diagnostics(item, context=context),
    }
    validate_batch_result([item], {item["item_id"]: payload}, diagnostics=diagnostics)
    return {item["item_id"]: payload}


def translate_single_item_stable_placeholder_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    item = item_with_runtime_hard_glossary(item, context.glossary_entries)
    original_to_alias, alias_to_original = placeholder_alias_maps(item)
    aliased_item = item_with_placeholder_aliases(item, original_to_alias)
    aliased_sequence = placeholder_sequence(
        aliased_item.get("translation_unit_protected_source_text")
        or aliased_item.get("group_protected_source_text")
        or aliased_item.get("protected_source_text")
        or aliased_item.get("source_text")
        or ""
    )
    stability_guidance = placeholder_stability_guidance(aliased_item, aliased_sequence)
    merged_guidance = "\n\n".join(part for part in [context.merged_guidance, stability_guidance.strip()] if part)
    result = translate_single_item_tagged_text(
        aliased_item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=merged_guidance,
        diagnostics=diagnostics,
        timeout_s=context.timeout_policy.plain_text_seconds,
    )
    restored = restore_placeholder_aliases(result, alias_to_original)
    restored = _restore_runtime_term_tokens(restored, item=item)
    restored = canonicalize_batch_result([item], restored)
    restored = _attach_result_metadata(
        restored,
        item=item,
        context=context,
        route_path=["block_level"],
        output_mode_path=["tagged"],
    )
    validate_batch_result([item], restored, diagnostics=diagnostics)
    return restored


def translate_single_item_plain_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    item = item_with_runtime_hard_glossary(item, context.glossary_entries)
    if not item.get("_heavy_formula_split_applied"):
        split_reason = _heavy_formula_split_reason(item, context=context)
        if split_reason:
            if request_label:
                print(f"{request_label}: split heavy formula block before formula routing reason={split_reason}", flush=True)
            split_result = _translate_heavy_formula_block(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                split_reason=split_reason,
            )
            if split_result is not None:
                return _attach_result_metadata(
                    _restore_runtime_term_tokens(split_result, item=item),
                    item=item,
                    context=context,
                    route_path=["block_level", "heavy_formula_split"],
                    output_mode_path=["plain_text"],
                    degradation_reason=split_reason,
                )
    formula_route = formula_segment_translation_route(item, policy=context.segmentation_policy)
    if formula_route in {"single", "small_inline"}:
        allow_windowed_fallback = formula_segment_window_count(item, policy=context.segmentation_policy) > 1
        try:
            segmented_result = translate_single_item_formula_segment_text_with_retries(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                policy=context.segmentation_policy,
                diagnostics=diagnostics,
                attempt_limit=context.fallback_policy.formula_segment_attempts,
                timeout_s=context.timeout_policy.formula_segment_seconds,
            )
            return _attach_result_metadata(
                _restore_runtime_term_tokens(segmented_result, item=item),
                item=item,
                context=context,
                route_path=["block_level", "small_formula_inline" if formula_route == "small_inline" else "segmented"],
                output_mode_path=["tagged"],
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: {'small-inline-formula' if formula_route == 'small_inline' else 'segmented-formula'} route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if allow_windowed_fallback:
                try:
                    windowed_result = translate_single_item_formula_segment_windows_with_retries(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=request_label,
                        domain_guidance=context.merged_guidance,
                        policy=context.segmentation_policy,
                        diagnostics=diagnostics,
                        attempt_limit=context.fallback_policy.formula_segment_attempts,
                        timeout_s=context.timeout_policy.formula_window_seconds,
                    )
                    return _attach_result_metadata(
                        _restore_runtime_term_tokens(windowed_result, item=item),
                        item=item,
                        context=context,
                        route_path=["block_level", "windowed"],
                        output_mode_path=["json_schema"],
                    )
                except Exception as windowed_exc:
                    if request_label:
                        print(
                            f"{request_label}: windowed-formula fallback failed, continue to plain-text path: {type(windowed_exc).__name__}: {windowed_exc}",
                            flush=True,
                        )
            elif request_label:
                print(f"{request_label}: skip windowed-formula fallback because only one formula window is available", flush=True)
    elif formula_route == "windowed":
        try:
            windowed_result = translate_single_item_formula_segment_windows_with_retries(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                policy=context.segmentation_policy,
                diagnostics=diagnostics,
                attempt_limit=context.fallback_policy.formula_segment_attempts,
                timeout_s=context.timeout_policy.formula_window_seconds,
            )
            return _attach_result_metadata(
                _restore_runtime_term_tokens(windowed_result, item=item),
                item=item,
                context=context,
                route_path=["block_level", "windowed"],
                output_mode_path=["json_schema"],
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: windowed-formula route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    last_error: Exception | None = None
    for attempt in range(1, context.fallback_policy.plain_text_attempts + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: plain-text attempt {attempt}/{context.fallback_policy.plain_text_attempts} item={item['item_id']}",
                    flush=True,
                )
            result = translate_single_item_plain_text(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
                timeout_s=context.timeout_policy.plain_text_seconds,
            )
            result = _restore_runtime_term_tokens(result, item=item)
            result = _attach_result_metadata(
                result,
                item=item,
                context=context,
                route_path=["block_level"],
                output_mode_path=["plain_text"],
            )
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: plain-text ok in {elapsed:.2f}s", flush=True)
            return result
        except (UnexpectedPlaceholderError, PlaceholderInventoryError, EmptyTranslationError, EnglishResidueError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: plain-text placeholder failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                log_placeholder_failure(request_label, item, exc, diagnostics=diagnostics)
            if has_formula_placeholders(item) and context.fallback_policy.allow_tagged_placeholder_retry:
                tagged_started = time.perf_counter()
                try:
                    if request_label:
                        print(
                            f"{request_label}: retrying with tagged single-item format for placeholder stability",
                            flush=True,
                        )
                    result = translate_single_item_stable_placeholder_text(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=f"{request_label} tagged" if request_label else "",
                        context=context,
                        diagnostics=diagnostics,
                    )
                    if request_label:
                        tagged_elapsed = time.perf_counter() - tagged_started
                        print(f"{request_label}: tagged single-item ok in {tagged_elapsed:.2f}s", flush=True)
                    return result
                except (ValueError, KeyError, json.JSONDecodeError) as tagged_exc:
                    last_error = tagged_exc
                    if request_label:
                        tagged_elapsed = time.perf_counter() - tagged_started
                        print(
                                f"{request_label}: tagged single-item failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {tagged_elapsed:.2f}s: {type(tagged_exc).__name__}: {tagged_exc}",
                                flush=True,
                        )
            if attempt >= context.fallback_policy.plain_text_attempts and isinstance(last_error, (EmptyTranslationError, EnglishResidueError)):
                raw_started = time.perf_counter()
                try:
                    if request_label:
                        print(f"{request_label}: retrying with raw plain-text single-item fallback", flush=True)
                    result = translate_single_item_plain_text_unstructured(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=f"{request_label} raw" if request_label else "",
                        domain_guidance=context.merged_guidance,
                        mode=context.mode,
                        diagnostics=diagnostics,
                        timeout_s=context.timeout_policy.plain_text_seconds,
                    )
                    if request_label:
                        raw_elapsed = time.perf_counter() - raw_started
                        print(f"{request_label}: raw plain-text single-item ok in {raw_elapsed:.2f}s", flush=True)
                    return _attach_result_metadata(
                        result,
                        item=item,
                        context=context,
                        route_path=["block_level", "plain_text_raw"],
                        output_mode_path=["plain_text"],
                    )
                except (ValueError, KeyError, json.JSONDecodeError, EnglishResidueError, EmptyTranslationError) as raw_exc:
                    last_error = raw_exc
                    if request_label:
                        raw_elapsed = time.perf_counter() - raw_started
                        print(
                            f"{request_label}: raw plain-text single-item failed after {raw_elapsed:.2f}s: {type(raw_exc).__name__}: {raw_exc}",
                            flush=True,
                        )
            if attempt >= context.fallback_policy.plain_text_attempts:
                if isinstance(last_error, EmptyTranslationError) and _should_keep_origin_on_empty_translation(item):
                    if request_label:
                        print(
                            f"{request_label}: degraded to keep_origin for short non-body empty translation",
                            flush=True,
                        )
                    return _keep_origin_payload_for_empty_translation(item)
                try:
                    return _sentence_level_fallback(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=request_label,
                        context=context,
                        diagnostics=diagnostics,
                    )
                except Exception as sentence_exc:
                    if request_label:
                        print(
                            f"{request_label}: sentence-level fallback failed: {type(sentence_exc).__name__}: {sentence_exc}",
                            flush=True,
                        )
                if isinstance(last_error, EnglishResidueError):
                    if diagnostics is not None:
                        diagnostics.emit(
                            kind="english_residue_degraded",
                            item_id=str(item.get("item_id", "") or ""),
                            page_idx=item.get("page_idx"),
                            severity="warning",
                            message="Degraded to keep_origin after repeated English-residue validation failure",
                            retryable=True,
                        )
                    if request_label:
                        print(
                            f"{request_label}: degraded to keep_origin after repeated English-residue validation failure",
                            flush=True,
                        )
                    payload = internal_keep_origin_result("english_residue_repeated")
                    payload["error_taxonomy"] = "validation"
                    payload["translation_diagnostics"] = {
                        "item_id": item.get("item_id", ""),
                        "page_idx": item.get("page_idx"),
                        "route_path": ["block_level", "keep_origin"],
                        "error_trace": [{"type": "validation", "code": "ENGLISH_RESIDUE"}],
                        "fallback_to": "keep_origin",
                        "degradation_reason": "english_residue_repeated",
                        "final_status": "kept_origin",
                        **_formula_route_diagnostics(item, context=context),
                    }
                    return {item["item_id"]: payload}
                if isinstance(last_error, EmptyTranslationError) and not should_force_translate_body_text(item):
                    if diagnostics is not None:
                        diagnostics.emit(
                            kind="empty_translation_degraded",
                            item_id=str(item.get("item_id", "") or ""),
                            page_idx=item.get("page_idx"),
                            severity="warning",
                            message="Degraded to keep_origin after repeated empty translation output",
                            retryable=True,
                        )
                    if request_label:
                        print(
                            f"{request_label}: degraded to keep_origin after repeated empty translation output",
                            flush=True,
                        )
                    return _keep_origin_payload_for_repeated_empty_translation(item)
                if (
                    has_formula_placeholders(item)
                    and context.fallback_policy.allow_keep_origin_degradation
                    and isinstance(last_error, (UnexpectedPlaceholderError, PlaceholderInventoryError))
                ):
                    if diagnostics is not None:
                        diagnostics.emit(
                            kind="placeholder_unstable",
                            item_id=str(item.get("item_id", "") or ""),
                            page_idx=item.get("page_idx"),
                            severity="warning",
                            message="Degraded to keep_origin after repeated placeholder instability",
                            retryable=True,
                        )
                    if request_label:
                        print(f"{request_label}: degraded to keep_origin after repeated placeholder instability", flush=True)
                        log_placeholder_failure(request_label, item, exc, diagnostics=diagnostics)
                    payload = internal_keep_origin_result("placeholder_unstable")
                    payload["error_taxonomy"] = "validation"
                    payload["translation_diagnostics"] = {
                        "item_id": item.get("item_id", ""),
                        "page_idx": item.get("page_idx"),
                        "route_path": ["block_level", "keep_origin"],
                        "error_trace": [{"type": "validation"}],
                        "fallback_to": "keep_origin",
                        "degradation_reason": "placeholder_unstable",
                        "final_status": "kept_origin",
                        **_formula_route_diagnostics(item, context=context),
                    }
                    return {item["item_id"]: payload}
                raise last_error
            time.sleep(min(8, 2 * attempt))
        except SuspiciousKeepOriginError as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: unexpected keep_origin after {elapsed:.2f}s: {type(exc).__name__}: {exc}", flush=True)
            if attempt >= context.fallback_policy.plain_text_attempts:
                raise
            time.sleep(min(8, 2 * attempt))
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: plain-text parse failed attempt {attempt}/{context.fallback_policy.plain_text_attempts} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= context.fallback_policy.plain_text_attempts:
                raise
            time.sleep(min(8, 2 * attempt))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Plain-text translation failed without an exception.")


def translate_items_plain_text(
    batch: list[dict],
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    batch = [item_with_runtime_hard_glossary(item, context.glossary_entries) for item in batch]
    cached_result, uncached_batch = split_cached_batch(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=context.cache_guidance,
        mode=context.mode,
    )
    if request_label and cached_result:
        print(f"{request_label}: plain-text cache hit {len(cached_result)}/{len(batch)}", flush=True)
    valid_cached: dict[str, dict[str, str]] = {}
    validated_uncached = list(uncached_batch)
    for item in batch:
        item_id = item["item_id"]
        cached_item_result = cached_result.get(item_id)
        if not cached_item_result:
            continue
        try:
            canonical = canonicalize_batch_result([item], {item_id: cached_item_result})
            validate_batch_result([item], canonical, diagnostics=diagnostics)
            valid_cached.update(canonical)
        except (
            ValueError,
            KeyError,
            json.JSONDecodeError,
            EnglishResidueError,
            EmptyTranslationError,
            UnexpectedPlaceholderError,
            PlaceholderInventoryError,
            TranslationProtocolError,
        ) as exc:
            validated_uncached.append(item)
            if request_label:
                print(
                    f"{request_label}: dropped invalid cached translation for {item_id}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    merged = dict(valid_cached)
    uncached_batch = validated_uncached
    if not uncached_batch:
        return merged
    if _should_use_direct_deepseek_batch(uncached_batch, model=model, base_url=base_url, context=context):
        try:
            if request_label:
                print(f"{request_label}: batched plain path items={len(uncached_batch)}", flush=True)
            result = translate_batch_once(
                uncached_batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=context.merged_guidance,
                mode=context.mode,
                diagnostics=diagnostics,
                timeout_s=context.timeout_policy.batch_plain_text_seconds,
            )
            restored_result: dict[str, dict[str, str]] = {}
            item_by_id = {item["item_id"]: item for item in uncached_batch}
            for item_id, payload in result.items():
                item_result = _restore_runtime_term_tokens({item_id: payload}, item=item_by_id[item_id])
                restored_result.update(
                    _attach_result_metadata(
                        item_result,
                        item=item_by_id[item_id],
                        context=context,
                        route_path=["block_level", "batched_plain"],
                        output_mode_path=["tagged"],
                    )
                )
            result = restored_result
            cacheable_batch = [
                item for item in uncached_batch if _should_store_translation_result(result.get(item["item_id"], {}))
            ]
            if cacheable_batch:
                store_cached_batch(
                    cacheable_batch,
                    result,
                    model=model,
                    base_url=base_url,
                    domain_guidance=context.cache_guidance,
                    mode=context.mode,
                )
            merged.update(result)
            return merged
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: batched plain fallback to single-item path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    total_items = len(uncached_batch)
    for index, item in enumerate(uncached_batch, start=1):
        item_label = f"{request_label} item {index}/{total_items} {item['item_id']}" if request_label else ""
        result = translate_single_item_plain_text_with_retries(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=item_label,
            context=context,
            diagnostics=diagnostics,
        )
        payload = result.get(item["item_id"], {})
        if _should_store_translation_result(payload):
            store_cached_batch(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=context.cache_guidance,
                mode=context.mode,
            )
        merged.update(result)
    return merged


def _should_use_direct_deepseek_batch(
    batch: list[dict],
    *,
    model: str,
    base_url: str,
    context: TranslationControlContext,
) -> bool:
    if len(batch) <= 1:
        return False
    if all(bool(item.get("_batched_plain_candidate")) for item in batch):
        return True
    del model, base_url
    return all(_is_low_risk_deepseek_batch_item(item, context=context) for item in batch)


def _is_low_risk_deepseek_batch_item(item: dict, *, context: TranslationControlContext) -> bool:
    if str(item.get("block_type", "") or "") != "text":
        return False
    if not is_body_structure_role(item.get("metadata", {}) or {}):
        return False
    if item.get("continuation_group"):
        return False
    if item.get("formula_map") or item.get("translation_unit_formula_map"):
        return False
    if len(placeholder_sequence(str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or ""))) > context.batch_policy.batch_low_risk_max_placeholders:
        return False
    if not should_force_translate_body_text(item):
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False
    compact_len = len(source_text)
    if compact_len < 40 or compact_len > context.batch_policy.batch_low_risk_max_chars:
        return False
    return True
