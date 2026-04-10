from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

from services.translation.llm.deepseek_client import DEFAULT_BASE_URL
from services.translation.llm.deepseek_client import get_api_key
from services.translation.llm.deepseek_client import normalize_base_url
from services.translation.llm.deepseek_client import request_chat_content
from services.translation.llm.structured_models import GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA
from services.translation.llm.structured_parsers import parse_garbled_reconstruction_response


GARBLED_LEGACY_STYLE_RE = re.compile(r"\\(?:bf|rm|it|sf|tt|pmb)\b")
COMMON_CLEAN_FORMULA_CMD_RE = re.compile(r"\\(?:mathrm|mathbf|mathit|mathsf|mathtt|text|textit|textbf)\b")
GARBLED_GREEK_RE = re.compile(r"(?:\\alpha|α)")
DOUBLE_BRACE_ALPHA_RE = re.compile(r"\{\s*\{\s*(?:\\alpha|α)\s*\}\s*\}")
ALL_CAP_DUP_RE = re.compile(r"\b([A-Z]{2,})(?=\s+\1\b)")
LEADING_GLUE_RE = re.compile(r"\b([A-Z])([A-Z][a-z]{3,})\b")


def _is_deepseek_provider(*, model: str, base_url: str) -> bool:
    normalized_base = normalize_base_url(base_url).lower()
    model_text = (model or "").strip().lower()
    return "deepseek" in model_text or "deepseek.com" in normalized_base


def _resolve_reconstruction_provider(
    *,
    api_key: str,
    model: str,
    base_url: str,
) -> tuple[str, str, str, str]:
    if _is_deepseek_provider(model=model, base_url=base_url):
        return api_key or get_api_key(required=False), model, base_url, "job_provider"

    deepseek_key = get_api_key(required=False)
    if deepseek_key:
        return deepseek_key, "deepseek-chat", DEFAULT_BASE_URL, "prefer_deepseek_api"

    return api_key, model, base_url, "job_provider_fallback"


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


def should_reconstruct_garbled_item(item: dict) -> bool:
    if str(item.get("block_type", "") or "") != "text":
        return False
    if not item.get("should_translate", True):
        return False

    source_text = _source_text(item)
    translated_text = _translated_text(item)
    bad_formulas = _bad_formula_entries(item)

    if bad_formulas and translated_text:
        return True
    if bad_formulas and len(source_text) >= 80:
        return True
    if _looks_like_duplicate_glued_text(source_text) and len(source_text) >= 80:
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


def _repair_item_translation(item: dict, *, api_key: str, model: str, base_url: str) -> str:
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
    content = request_chat_content(
        messages,
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA,
        timeout=120,
        request_label=f"garbled-reconstruct {item.get('item_id', '')}",
    )
    return parse_garbled_reconstruction_response(content)


def _apply_reconstruction(items: list[dict], translated_text: str) -> None:
    if not translated_text:
        return
    for item in items:
        item["protected_translated_text"] = translated_text
        item["translated_text"] = translated_text
        item["translation_unit_protected_translated_text"] = translated_text
        item["translation_unit_translated_text"] = translated_text
        item["group_protected_translated_text"] = translated_text
        item["group_translated_text"] = translated_text
        item["formula_map"] = []
        item["translation_unit_formula_map"] = []
        item["group_formula_map"] = []
        if "render_formula_map" in item:
            item["render_formula_map"] = []
        item["classification_label"] = "llm_reconstructed_garbled"
        item["skip_reason"] = ""


def _candidate_key(item: dict) -> str:
    unit_kind = str(item.get("translation_unit_kind", "") or "")
    unit_id = str(item.get("translation_unit_id", "") or "")
    if unit_kind == "group" and unit_id:
        return f"group:{unit_id}"
    return f"item:{item.get('item_id', '')}"


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
) -> tuple[int, set[int]]:
    reconstructed = 0
    dirty_pages: set[int] = set()
    resolved_api_key, resolved_model, resolved_base_url, provider_reason = _resolve_reconstruction_provider(
        api_key=api_key,
        model=model,
        base_url=base_url,
    )
    max_workers = max(1, min(workers, 4, len(candidate_list)))
    print(f"book: garbled reconstruction candidates={len(candidate_list)} workers={max_workers}", flush=True)
    print(
        f"book: garbled reconstruction provider={resolved_model} {normalize_base_url(resolved_base_url)}"
        f" reason={provider_reason}",
        flush=True,
    )

    if max_workers == 1:
        for key, item in candidate_list:
            try:
                translated_text = _repair_item_translation(
                    item,
                    api_key=resolved_api_key,
                    model=resolved_model,
                    base_url=resolved_base_url,
                )
            except Exception as exc:
                print(f"garbled-reconstruct {item.get('item_id', '')}: skipped: {type(exc).__name__}: {exc}", flush=True)
                continue
            if translated_text:
                target_items = candidates_by_key[key]
                _apply_reconstruction(target_items, translated_text)
                reconstructed += 1
                dirty_pages.update(_collect_dirty_pages(target_items))
        return reconstructed, dirty_pages

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                _repair_item_translation,
                item,
                api_key=resolved_api_key,
                model=resolved_model,
                base_url=resolved_base_url,
            ): (key, item)
            for key, item in candidate_list
        }
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
    return reconstructed, dirty_pages


def reconstruct_garbled_items(
    payload: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
) -> dict[str, int]:
    candidates_by_key, representatives = _collect_candidates(payload)
    if not representatives:
        return {"garbled_candidates": 0, "garbled_reconstructed": 0}

    candidate_list = [(key, representatives[key]) for key in sorted(representatives)]
    reconstructed, _dirty_pages = _run_reconstruction_candidates(
        candidate_list,
        candidates_by_key=candidates_by_key,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
    )
    return {"garbled_candidates": len(candidate_list), "garbled_reconstructed": reconstructed}


def reconstruct_garbled_page_payloads(
    page_payloads: dict[int, list[dict]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
) -> dict[str, object]:
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    candidates_by_key, representatives = _collect_candidates(flat_payload)
    if not representatives:
        return {
            "garbled_candidates": 0,
            "garbled_reconstructed": 0,
            "dirty_pages": [],
        }

    candidate_list = [(key, representatives[key]) for key in sorted(representatives)]
    reconstructed, dirty_pages = _run_reconstruction_candidates(
        candidate_list,
        candidates_by_key=candidates_by_key,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
    )
    return {
        "garbled_candidates": len(candidate_list),
        "garbled_reconstructed": reconstructed,
        "dirty_pages": sorted(dirty_pages),
    }


__all__ = [
    "reconstruct_garbled_items",
    "reconstruct_garbled_page_payloads",
    "should_reconstruct_garbled_item",
]
