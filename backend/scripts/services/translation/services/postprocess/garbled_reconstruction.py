from __future__ import annotations

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Callable

from services.translation.core.item_reader import item_block_kind
from services.translation.core.payload.formula_protection import restore_protected_tokens
from services.translation.core.payload.parts.apply import apply_reconstructed_unit_text
from services.translation.core.payload.parts.diagnostics import record_translation_diagnostics
from services.translation.core.payload.parts.final_status import TRANSLATED_STATUS
from services.translation.core.payload.parts.final_status import set_final_status
from services.translation.core.payload.parts.policy_state import mark_translation_required
from services.translation.core.payload.parts.result_entries import salvage_reasoning_leak
from services.translation.llm.shared.structured_models import GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA
from services.translation.llm.shared.structured_parsers import parse_garbled_reconstruction_response
from services.translation.artifacts.status import has_translation_artifact
from services.translation.services.policy import should_skip_model_by_policy
from services.translation.services.quality import review_translation_item


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
    content = runtime.request_chat_content_fn(
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
    # Multiplex Master Translation Backfilled Wash:Loại bỏ mô hình reasoning tiết lộ,Khôi phục chỗ dành sẵn。
    # Các bản dịch khác/Sửa chữa tất cả các đường dẫn đi qua apply.py Thực hiện hai bước này,Chỉ có việc xây dựng lại mã bị cắt xén đã trực tiếp làm giảm đầu ra ban đầu của mô hình。
    salvaged, salvage_changed = salvage_reasoning_leak(text)
    protected_map = item.get("protected_map") or item.get("formula_map", [])
    return restore_protected_tokens(salvaged, protected_map), salvage_changed


def _apply_reconstruction(items: list[dict], translated_text: str) -> None:
    if not translated_text or not items:
        return
    cleaned_text, salvaged = _clean_reconstructed_text(translated_text, items[0])
    # Kiểm tra chất lượng với văn bản đã được làm sạch:Xác minh bất cứ thứ gì rơi trên khay。
    validation_issues = _validate_reconstruction(items[0], cleaned_text)
    if validation_issues:
        for item in items:
            _record_reconstruction_rejected(item, validation_issues)
        return
    apply_reconstructed_unit_text(items, cleaned_text)
    for item in items:
        # Ứng viên được đảm bảo should_translate=True(verdict sẽ đưa ra False ngăn ở
        # should_skip_model_by_policy Beyond),Viết ở đây True Là hoạt động giống hệt nhau。
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
        if salvaged:
            updates["reasoning_leak_salvaged"] = True
        record_translation_diagnostics(item, "garbled_reconstruction", updates)


def _candidate_key(item: dict) -> str:
    return f"item:{item.get('item_id', '')}"


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


def _record_reconstruction_rejected(item: dict, issues: list) -> None:
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
    candidates_by_key: dict[str, list[dict]] = {}
    representatives: dict[str, dict] = {}
    for item in items:
        if not should_reconstruct_garbled_item(item):
            continue
        key = _candidate_key(item)
        candidates_by_key.setdefault(key, []).append(item)
        representatives.setdefault(key, item)
    return candidates_by_key, representatives


def _collect_dirty_pages(items: list[dict]) -> set[int]:
    dirty_pages: set[int] = set()
    for item in items:
        page_idx = item.get("page_idx")
        if isinstance(page_idx, int):
            dirty_pages.add(page_idx)
    return dirty_pages


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
) -> tuple[int, set[int]]:
    reconstructed = 0
    dirty_pages: set[int] = set()
    max_workers = max(1, min(workers, 12, len(candidate_list)))
    print(f"book: garbled reconstruction candidates={len(candidate_list)} workers={max_workers}", flush=True)
    print(
        f"book: garbled reconstruction provider={runtime.model} {runtime.display_base_url()}"
        f" reason={runtime.provider_reason}",
        flush=True,
    )

    if max_workers == 1:
        for completed, (key, item) in enumerate(candidate_list, start=1):
            try:
                translated_text = _repair_item_translation(
                    item,
                    runtime=runtime,
                )
            except Exception as exc:
                print(f"garbled-reconstruct {item.get('item_id', '')}: skipped: {type(exc).__name__}: {exc}", flush=True)
                continue
            if translated_text:
                target_items = candidates_by_key[key]
                _apply_reconstruction(target_items, translated_text)
                reconstructed += 1
                dirty_pages.update(_collect_dirty_pages(target_items))
            if progress_callback is not None:
                progress_callback(completed, len(candidate_list), set(dirty_pages))
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
        completed = 0
        for future in as_completed(future_map):
            key, item = future_map[future]
            try:
                translated_text = future.result()
            except Exception as exc:
                print(f"garbled-reconstruct {item.get('item_id', '')}: skipped: {type(exc).__name__}: {exc}", flush=True)
                continue
            if translated_text:
                target_items = candidates_by_key[key]
                _apply_reconstruction(target_items, translated_text)
                reconstructed += 1
                dirty_pages.update(_collect_dirty_pages(target_items))
            completed += 1
            if progress_callback is not None:
                progress_callback(completed, len(candidate_list), set(dirty_pages))
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
    candidates_by_key, representatives = _collect_candidates(payload)
    if not representatives:
        return {"garbled_candidates": 0, "garbled_reconstructed": 0}

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
    )
    return {
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
    candidates_by_key, representatives = _collect_candidates(flat_payload)
    if not representatives:
        return {
            "garbled_candidates": 0,
            "garbled_attempted": 0,
            "garbled_skipped_by_budget": 0,
            "garbled_reconstructed": 0,
            "dirty_pages": [],
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
    )
    return {
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
