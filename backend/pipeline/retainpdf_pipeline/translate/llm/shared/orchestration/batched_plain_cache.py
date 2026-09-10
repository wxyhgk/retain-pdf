from __future__ import annotations

import json

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import EnglishResidueError
from retainpdf_pipeline.translate.llm.validation.errors import MathDelimiterError
from retainpdf_pipeline.translate.llm.validation.errors import PlaceholderInventoryError
from retainpdf_pipeline.translate.llm.validation.errors import TranslationProtocolError
from retainpdf_pipeline.translate.llm.validation.errors import TruncatedTranslationError
from retainpdf_pipeline.translate.llm.validation.errors import UnexpectedPlaceholderError


_CACHE_VALIDATION_ERRORS = (
    ValueError,
    KeyError,
    json.JSONDecodeError,
    EnglishResidueError,
    EmptyTranslationError,
    MathDelimiterError,
    UnexpectedPlaceholderError,
    PlaceholderInventoryError,
    TranslationProtocolError,
    TruncatedTranslationError,
)


def split_and_validate_cached_batch(
    batch: list[dict],
    *,
    model: str,
    base_url: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    request_label: str,
    split_cached_batch_fn,
) -> tuple[dict[str, dict[str, str]], list[dict]]:
    cached_result, uncached_batch = split_cached_batch_fn(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=context.cache_guidance,
        mode=context.mode,
        target_lang=context.target_lang,
        target_language_name=context.target_language_name,
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
        except _CACHE_VALIDATION_ERRORS as exc:
            validated_uncached.append(item)
            if request_label:
                print(f"{request_label}: dropped invalid cached translation for {item_id}: {type(exc).__name__}: {exc}", flush=True)
    return valid_cached, validated_uncached


def store_cacheable_batch_result(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    model: str,
    base_url: str,
    context,
    store_cached_batch_fn,
    should_store_translation_result_fn,
) -> None:
    cacheable_batch = [item for item in batch if should_store_translation_result_fn(result.get(item["item_id"], {}))]
    if cacheable_batch:
        store_cached_batch_fn(
            cacheable_batch,
            result,
            model=model,
            base_url=base_url,
            domain_guidance=context.cache_guidance,
            mode=context.mode,
            target_lang=context.target_lang,
            target_language_name=context.target_language_name,
        )
