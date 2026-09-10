from __future__ import annotations
from retainpdf_pipeline.translate.llm.shared.executor_context import scoped_request

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Callable
from typing import Literal

from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.payload.formula_protection import restore_protected_tokens
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_group_translated_entry
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_reconstructed_unit_text
from retainpdf_pipeline.translate.core.payload.parts.common import effective_translation_unit_id
from retainpdf_pipeline.translate.core.payload.parts.common import item_has_multi_member_group_unit
from retainpdf_pipeline.translate.core.payload.parts.diagnostics import record_translation_diagnostics
from retainpdf_pipeline.translate.core.payload.parts.final_status import TRANSLATED_STATUS
from retainpdf_pipeline.translate.core.payload.parts.final_status import set_final_status
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_translation_required
from retainpdf_pipeline.translate.core.payload.parts.result_entries import salvage_reasoning_leak
from retainpdf_pipeline.translate.core.payload.parts.units import pending_translation_items
from retainpdf_pipeline.translate.llm.shared.structured_models import GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA
from retainpdf_pipeline.translate.llm.shared.structured_parsers import parse_garbled_reconstruction_response
from retainpdf_pipeline.translate.artifacts.status import has_translation_artifact
from retainpdf_pipeline.translate.services.policy import should_skip_model_by_policy
from retainpdf_pipeline.translate.services.quality import review_translation_item
from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue


MAX_CANDIDATES_ENV = "RETAIN_TRANSLATION_GARBLED_MAX_CANDIDATES"
DEFAULT_MAX_CANDIDATES = 64


GARBLED_LEGACY_STYLE_RE = re.compile(r"\\(?:bf|rm|it|sf|tt|pmb)\b")
COMMON_CLEAN_FORMULA_CMD_RE = re.compile(r"\\(?:mathrm|mathbf|mathit|mathsf|mathtt|text|textit|textbf)\b")
GARBLED_GREEK_RE = re.compile(r"(?:\\alpha|α)")
DOUBLE_BRACE_ALPHA_RE = re.compile(r"\{\s*\{\s*(?:\\alpha|α)\s*\}\s*\}")
ALL_CAP_DUP_RE = re.compile(r"\b([A-Z]{2,})(?=\s+\1\b)")
LEADING_GLUE_RE = re.compile(r"\b([A-Z])([A-Z][a-z]{3,})\b")


@dataclass(frozen=True)
class GarbledReconstructionRuntime:
    api_key: str
    model: str
    base_url: str
    provider_reason: str
    request_chat_content_fn: Callable[..., str]
    normalize_base_url_fn: Callable[[str], str] | None = None

    def display_base_url(self) -> str:
        if self.normalize_base_url_fn is None:
            return self.base_url
        return self.normalize_base_url_fn(self.base_url)


def _formula_map(item: dict) -> list[dict]:
    return (
        item.get("translation_unit_formula_map")
        or item.get("formula_map")
        or item.get("render_formula_map")
        or []
    )


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    ).strip()


def _translated_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_translated_text")
        or item.get("protected_translated_text")
        or item.get("translated_text")
        or ""
    ).strip()


def _looks_like_duplicate_glued_text(text: str) -> bool:
    if not text:
        return False
    if "ASMALL" in text or "ABIG" in text:
        return True
    if LEADING_GLUE_RE.search(text):
        return True
    return bool(ALL_CAP_DUP_RE.search(text))


def _formula_is_garbled(formula_text: str) -> bool:
    text = str(formula_text or "").strip()
    if not text:
        return False
    legacy_style_count = len(GARBLED_LEGACY_STYLE_RE.findall(text))
    clean_formula_cmd_count = len(COMMON_CLEAN_FORMULA_CMD_RE.findall(text))
    greek_count = len(GARBLED_GREEK_RE.findall(text))
    double_alpha_count = len(DOUBLE_BRACE_ALPHA_RE.findall(text))
    if greek_count >= 8:
        return True
    if legacy_style_count >= 2:
        return True
    if double_alpha_count >= 2:
        return True
    if clean_formula_cmd_count >= 3 and legacy_style_count == 0 and greek_count <= 2 and double_alpha_count == 0:
        return False
    if len(text) >= 180 and greek_count >= 4:
        return True
    return False


def _bad_formula_entries(item: dict) -> list[dict]:
    return [entry for entry in _formula_map(item) if _formula_is_garbled(entry.get("formula_text", ""))]


def _has_formula_identity(item: dict) -> bool:
    if _formula_map(item):
        return True
    protected_map = item.get("translation_unit_protected_map") or item.get("protected_map") or []
    if not isinstance(protected_map, list):
        return False
    return any(str(entry.get("token_type", "") or "") == "formula" for entry in protected_map if isinstance(entry, dict))


def should_reconstruct_garbled_item(item: dict) -> bool:
    if item_block_kind(item) != "text":
        return False
    if should_skip_model_by_policy(item):
        return False

    source_text = _source_text(item)
    translated_text = _translated_text(item)
    bad_formulas = _bad_formula_entries(item)
    final_status = str(item.get("final_status", "") or "").strip()
    diagnostics = dict(item.get("translation_diagnostics") or {})
    low_quality_translation = (
        not translated_text
        or final_status == "failed"
        or str(diagnostics.get("final_status", "") or "").strip() == "failed"
    )

    if bad_formulas and low_quality_translation:
        return True
    if bad_formulas and not has_translation_artifact(item) and len(source_text) >= 80:
        return True
    if _has_formula_identity(item):
        return False
    if _looks_like_duplicate_glued_text(source_text) and low_quality_translation and len(source_text) >= 80:
        return True
    if not translated_text and len(source_text) >= 120:
        return True
    return False


def _build_formula_hints(item: dict) -> list[str]:
    hints: list[str] = []
    for entry in _formula_map(item):
        text = str(entry.get("formula_text", "") or "").strip()
        if not text:
            continue
        if _formula_is_garbled(text):
            continue
        if len(text) > 80:
            continue
        hints.append(text)
    return hints[:12]


def _repair_item_translation(item: dict, *, runtime: GarbledReconstructionRuntime) -> str:
    source_text = _source_text(item)
    formula_hints = _build_formula_hints(item)
    messages = [
        {
            "role": "system",
            "content": (
                "You repair corrupted OCR scientific text blocks and translate them into fluent Simplified Chinese.\n"
                "The input may contain duplicated fragments, broken line wraps, and fake LaTeX formula noise.\n"
                "Reconstruct the intended meaning conservatively.\n"
                "Do not mention that the OCR is corrupted.\n"
                "Return one JSON object with key translated_text only.\n"
                "Output plain Chinese text only inside translated_text.\n"
                "Do not emit LaTeX commands like \\\\bf, \\\\mathbf, \\\\mathrm.\n"
                "If a material or symbol is obvious, keep it in natural scientific notation such as alpha-Al2O3 or α-Al2O3.\n"
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "item_id": item.get("item_id", ""),
                    "source_text": source_text,
                    "formula_hints": formula_hints,
                },
                ensure_ascii=False,
            ),
        },
    ]
    content = scoped_request("translation", [str(item.get("item_id", ""))], runtime.request_chat_content_fn,
        messages,
        api_key=runtime.api_key,
        model=runtime.model,
        base_url=runtime.base_url,
        temperature=0.0,
        response_format=GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA,
        timeout=120,
        request_label=f"garbled-reconstruct {item.get('item_id', '')}",
    )
    return parse_garbled_reconstruction_response(content)


def _clean_reconstructed_text(text: str, item: dict) -> tuple[str, bool]:
    # 复用主翻译回填的清洗:剥离模型 reasoning 泄漏,再还原占位符。
    # 其它翻译/修复路径都经 apply.py 做这两步,唯独乱码重建曾直接落盘模型原始输出。
    salvaged, salvage_changed = salvage_reasoning_leak(text)
    protected_map = (
        item.get("translation_unit_protected_map")
        or item.get("translation_unit_formula_map")
        or item.get("protected_map")
        or item.get("formula_map", [])
    )
    return restore_protected_tokens(salvaged, protected_map), salvage_changed


@dataclass(frozen=True)
class PreparedReconstruction:
    outcome: Literal["ready", "rejected", "no_result"]
    cleaned_text: str = ""
    salvaged: bool = False
    issues: tuple[TranslationQualityIssue, ...] = ()


@dataclass(frozen=True)
class ReconstructionApplication:
    outcome: Literal["applied", "rejected", "no_result"]
    # Touched pages, including diagnostic-only rejection writes.
    dirty_pages: frozenset[int] = frozenset()


def _prepare_reconstruction(
    items: list[dict], translated_text: str,
) -> PreparedReconstruction:
    """Clean and validate a response without modifying its target items."""
    if not translated_text or not items:
        return PreparedReconstruction("no_result")
    cleaned_text, salvaged = _clean_reconstructed_text(translated_text, items[0])
    # 用清洗后的文本做质量校验:落盘什么就校验什么。
    issues = tuple(_validate_reconstruction(items[0], cleaned_text))
    return PreparedReconstruction(
        "rejected" if issues else "ready", cleaned_text, salvaged, issues,
    )


def _apply_prepared_reconstruction(
    items: list[dict], prepared: PreparedReconstruction,
) -> ReconstructionApplication:
    """Apply a prepared response to the same targets; never request or validate."""
    if prepared.outcome == "no_result" or not items:
        return ReconstructionApplication("no_result")
    if prepared.outcome == "rejected":
        for item in items:
            _record_reconstruction_rejected(item, prepared.issues)
        return ReconstructionApplication("rejected", frozenset(_collect_dirty_pages(items)))
    if _is_aggregate_geometry_group(items[0]):
        apply_group_translated_entry(
            items,
            {
                "decision": "translate",
                "translated_text": prepared.cleaned_text,
                "final_status": "translated",
            },
        )
    else:
        apply_reconstructed_unit_text(items, prepared.cleaned_text)
    for item in items:
        # 候选资格已保证 should_translate=True(verdict 会把显式 False 挡在
        # should_skip_model_by_policy 之外),此处写 True 为恒等操作。
        mark_translation_required(item, label="llm_reconstructed_garbled")
        set_final_status(item, TRANSLATED_STATUS)
        prior = dict(item.get("translation_diagnostics") or {})
        route_path = [str(part or "") for part in prior.get("route_path") or [] if str(part or "")]
        route_path = [part for part in route_path if part != "failed"]
        updates = {
            "final_status": "translated",
            "garbled_reconstructed": True,
            "degradation_reason": "garbled_reconstructed",
            "fallback_to": "",
            "route_path": route_path + ["garbled_reconstruction"],
        }
        if prepared.salvaged:
            updates["reasoning_leak_salvaged"] = True
        record_translation_diagnostics(item, "garbled_reconstruction", updates)
    return ReconstructionApplication("applied", frozenset(_collect_dirty_pages(items)))


def _apply_reconstruction(
    items: list[dict], translated_text: str,
) -> Literal["applied", "rejected", "no_result"]:
    """Compatibility entrypoint for callers expecting only the outcome."""
    return _apply_prepared_reconstruction(
        items, _prepare_reconstruction(items, translated_text),
    ).outcome


def _candidate_key(item: dict) -> str:
    if _is_aggregate_geometry_group(item):
        return effective_translation_unit_id(item)
    return f"item:{item.get('item_id', '')}"


def _is_aggregate_geometry_group(item: dict) -> bool:
    return (
        str(item.get("translation_group_strategy", "") or "").strip() == "aggregate_geometry"
        and item_has_multi_member_group_unit(item)
    )


def _validate_reconstruction(item: dict, translated_text: str) -> list:
    review = review_translation_item(
        item,
        {
            "decision": "translate",
            "translated_text": translated_text,
        },
    )
    item_id = str(item.get("item_id", "") or "")
    return [
        issue
        for issue in review.issues
        if issue.item_id == item_id and issue.severity == "error"
    ]


def _record_reconstruction_rejected(item: dict, issues: tuple[TranslationQualityIssue, ...]) -> None:
    record_translation_diagnostics(
        item,
        "garbled_reconstruction",
        {
            "garbled_reconstruction_rejected": True,
            "garbled_reconstruction_issue_kinds": [issue.kind for issue in issues],
            "garbled_reconstruction_issues": [issue.as_dict() for issue in issues],
        },
    )


def _collect_candidates(items: list[dict]) -> tuple[dict[str, list[dict]], dict[str, dict]]:
    candidate_keys: set[str] = set()
    representatives: dict[str, dict] = {}
    for item in items:
        if not should_reconstruct_garbled_item(item):
            continue
        key = _candidate_key(item)
        candidate_keys.add(key)
        representatives.setdefault(key, item)
    candidates_by_key: dict[str, list[dict]] = {key: [] for key in candidate_keys}
    for item in items:
        key = _candidate_key(item)
        if key in candidate_keys:
            candidates_by_key[key].append(item)
    return candidates_by_key, representatives


def _collect_dirty_pages(items: list[dict]) -> set[int]:
    dirty_pages: set[int] = set()
    for item in items:
        page_idx = item.get("page_idx")
        if isinstance(page_idx, int):
            dirty_pages.add(page_idx)
    return dirty_pages


def _empty_reconstruction_counts() -> dict[str, int]:
    return {f"garbled_{outcome}": 0 for outcome in (
        "applied", "rejected", "no_result", "failed", "completed",
    )}


def _run_reconstruction_candidates(
    candidate_list: list[tuple[str, dict]],
    *,
    candidates_by_key: dict[str, list[dict]],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    runtime: GarbledReconstructionRuntime,
    progress_callback: Callable[[int, int, set[int]], None] | None = None,
    result_counts: dict[str, int] | None = None,
) -> tuple[int, set[int]]:
    reconstructed = 0
    dirty_pages: set[int] = set()
    counts = _empty_reconstruction_counts()
    if result_counts is not None:
        result_counts.update(counts)

    def settle(key: str, translated_text: str, *, failed: bool = False) -> None:
        nonlocal reconstructed
        outcome = "failed" if failed else "no_result"
        if not failed and translated_text:
            target_items = candidates_by_key[key]
            # Programming/validation/application failures must still propagate;
            # they are not recoverable request or response parsing failures.
            prepared = _prepare_reconstruction(target_items, translated_text)
            result = _apply_prepared_reconstruction(target_items, prepared)
            outcome = result.outcome
            reconstructed += int(outcome == "applied")
            dirty_pages.update(result.dirty_pages)
        counts[f"garbled_{outcome}"] += 1
        counts["garbled_completed"] += 1
        if result_counts is not None:
            result_counts.update(counts)
        if progress_callback is not None:
            progress_callback(counts["garbled_completed"], len(candidate_list), set(dirty_pages))
    max_workers = max(1, min(workers, 12, len(candidate_list)))
    print(f"book: garbled reconstruction candidates={len(candidate_list)} workers={max_workers}", flush=True)
    print(
        f"book: garbled reconstruction provider={runtime.model} {runtime.display_base_url()}"
        f" reason={runtime.provider_reason}",
        flush=True,
    )

    if max_workers == 1:
        for key, item in candidate_list:
            try:
                translated_text = _repair_item_translation(
                    item,
                    runtime=runtime,
                )
            except Exception:
                print("garbled-reconstruct: skipped category=request_or_parse_failed", flush=True)
                settle(key, "", failed=True)
                continue
            settle(key, translated_text)
        return reconstructed, dirty_pages

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                _repair_item_translation,
                item,
                runtime=runtime,
            ): (key, item)
            for key, item in candidate_list
        }
        for future in as_completed(future_map):
            key, item = future_map[future]
            try:
                translated_text = future.result()
            except Exception:
                print("garbled-reconstruct: skipped category=request_or_parse_failed", flush=True)
                settle(key, "", failed=True)
                continue
            settle(key, translated_text)
    return reconstructed, dirty_pages


def reconstruct_garbled_items(
    payload: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    runtime: GarbledReconstructionRuntime,
) -> dict[str, int]:
    pending_translation_items(payload)
    candidates_by_key, representatives = _collect_candidates(payload)
    counts = _empty_reconstruction_counts()
    if not representatives:
        return {"garbled_candidates": 0, "garbled_reconstructed": 0,
                "garbled_attempted": 0, "garbled_skipped_by_budget": 0, **counts}

    candidate_list = [(key, representatives[key]) for key in sorted(representatives)]
    total_candidates = len(candidate_list)
    candidate_list = candidate_list[: _max_candidates_from_env(DEFAULT_MAX_CANDIDATES)]
    reconstructed, _dirty_pages = _run_reconstruction_candidates(
        candidate_list,
        candidates_by_key=candidates_by_key,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        runtime=runtime,
        result_counts=counts,
    )
    return {
        **counts,
        "garbled_candidates": total_candidates,
        "garbled_attempted": len(candidate_list),
        "garbled_skipped_by_budget": max(0, total_candidates - len(candidate_list)),
        "garbled_reconstructed": reconstructed,
    }


def reconstruct_garbled_page_payloads(
    page_payloads: dict[int, list[dict]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    runtime: GarbledReconstructionRuntime,
    progress_callback: Callable[[int, int, set[int]], None] | None = None,
) -> dict[str, object]:
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    pending_translation_items(flat_payload)
    candidates_by_key, representatives = _collect_candidates(flat_payload)
    counts = _empty_reconstruction_counts()
    if not representatives:
        return {
            "garbled_candidates": 0,
            "garbled_attempted": 0,
            "garbled_skipped_by_budget": 0,
            "garbled_reconstructed": 0,
            "dirty_pages": [],
            **counts,
        }

    candidate_list = [(key, representatives[key]) for key in sorted(representatives)]
    total_candidates = len(candidate_list)
    candidate_list = candidate_list[: _max_candidates_from_env(DEFAULT_MAX_CANDIDATES)]
    reconstructed, dirty_pages = _run_reconstruction_candidates(
        candidate_list,
        candidates_by_key=candidates_by_key,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        runtime=runtime,
        progress_callback=progress_callback,
        result_counts=counts,
    )
    return {
        **counts,
        "garbled_candidates": total_candidates,
        "garbled_attempted": len(candidate_list),
        "garbled_skipped_by_budget": max(0, total_candidates - len(candidate_list)),
        "garbled_reconstructed": reconstructed,
        "dirty_pages": sorted(dirty_pages),
    }


def _max_candidates_from_env(default: int) -> int:
    raw = str(os.environ.get(MAX_CANDIDATES_ENV, "") or "").strip()
    if not raw:
        return max(0, int(default))
    try:
        return max(0, int(raw))
    except ValueError:
        return max(0, int(default))


__all__ = [
    "reconstruct_garbled_items",
    "reconstruct_garbled_page_payloads",
    "GarbledReconstructionRuntime",
    "should_reconstruct_garbled_item",
]
