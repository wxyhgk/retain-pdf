import json
import re

from ..formula_protection import restore_inline_formulas
from ..formula_protection import restore_protected_tokens
from .common import (
    clear_translation_fields,
    effective_translation_unit_id,
    is_group_unit_id,
)
from .translation_units import refresh_payload_translation_units

KEEP_ORIGIN_LABEL = "skip_model_keep_origin"
TOKEN_RE = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
INLINE_MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
MATH_AWARE_TOKEN_RE = re.compile(rf"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\s+|{INLINE_MATH_SPAN_RE.pattern}|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
SPLIT_PUNCTUATION = "。！？；，、,.!?;:)]}）】」』"


def _unwrap_json_translated_text(text: str) -> tuple[str, str] | None:
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


def _normalize_result_entry(value) -> tuple[str, str]:
    if isinstance(value, dict):
        decision = str(value.get("decision", "translate") or "translate").strip() or "translate"
        translated_text = str(value.get("translated_text", "") or "").strip()
        return decision, translated_text
    text = str(value or "").strip()
    unwrapped = _unwrap_json_translated_text(text)
    if unwrapped is not None:
        return unwrapped
    return "translate", text


def _extract_result_metadata(value) -> dict:
    if isinstance(value, dict):
        return dict(value)
    raw = str(value or "").strip()
    if not raw.startswith("{") or ("translated_text" not in raw and "translations" not in raw):
        return {}
    try:
        payload = json.loads(raw)
    except Exception:
        return {}
    return dict(payload) if isinstance(payload, dict) else {}


def _result_diagnostics_for_item(metadata: dict, item: dict) -> dict:
    diagnostics = dict(metadata.get("translation_diagnostics") or {})
    if not diagnostics:
        return {}
    diagnostics["item_id"] = item.get("item_id", "")
    if item.get("page_idx") is not None:
        diagnostics["page_idx"] = item.get("page_idx")
    return diagnostics


def _mark_keep_origin(item: dict) -> None:
    item["classification_label"] = KEEP_ORIGIN_LABEL
    item["should_translate"] = False
    item["skip_reason"] = KEEP_ORIGIN_LABEL
    item["final_status"] = "kept_origin"
    clear_translation_fields(item)


def _join_prefix_and_tail(prefix: str, tail: str) -> str:
    left = prefix.rstrip()
    right = tail.strip()
    if not left:
        return right
    if not right:
        return left
    if right[:1] in ",.;:!?)]}":
        return left + right
    return f"{left} {right}"


def _token_units(token: str) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return 0.2
    if token.startswith("<") or token.startswith("[[FORMULA_"):
        return 3.0
    if re.fullmatch(r"[A-Za-z0-9_\-./]+", token):
        return max(1.0, len(token) * 0.55)
    return 1.0


def _text_units(text: str) -> float:
    return sum(_token_units(token) for token in TOKEN_RE.findall(str(text or "")))


def _tokenize_group_translation(text: str) -> list[str]:
    return MATH_AWARE_TOKEN_RE.findall(str(text or "").strip())


def _join_tokens(tokens: list[str]) -> str:
    return "".join(tokens).strip()


def _split_group_protected_translation(protected_text: str, items: list[dict]) -> list[str]:
    if len(items) <= 1:
        return [str(protected_text or "").strip()]
    tokens = _tokenize_group_translation(protected_text)
    if not tokens:
        return [""] * len(items)

    token_costs = [_token_units(token) for token in tokens]
    total_cost = sum(token_costs)
    if total_cost <= 0:
        return [_join_tokens(tokens)] + [""] * (len(items) - 1)

    source_weights = [
        max(1.0, _text_units(item.get("protected_source_text") or item.get("source_text") or ""))
        for item in items
    ]
    total_source_weight = max(1.0, sum(source_weights))

    chunks: list[str] = []
    cursor = 0
    cumulative_target_cost = 0.0
    source_seen = 0.0
    for index, weight in enumerate(source_weights[:-1]):
        source_seen += weight
        target_cost = total_cost * source_seen / total_source_weight
        cumulative = cumulative_target_cost
        anchor = cursor + 1
        while anchor < len(tokens) - (len(source_weights) - index - 1) and cumulative < target_cost:
            cumulative += token_costs[anchor - 1]
            anchor += 1

        left = max(cursor + 1, anchor - 36)
        right = min(len(tokens) - (len(source_weights) - index - 1), anchor + 36)
        best = anchor
        best_score = None
        for probe in range(left, right + 1):
            if probe <= cursor:
                continue
            probe_cost = cumulative_target_cost + sum(token_costs[cursor:probe])
            score = abs(probe_cost - target_cost)
            prev = tokens[probe - 1].rstrip() if probe - 1 < len(tokens) else ""
            if prev.endswith(SPLIT_PUNCTUATION):
                score -= 2.0
            if best_score is None or score < best_score:
                best = probe
                best_score = score

        chunks.append(_join_tokens(tokens[cursor:best]))
        cumulative_target_cost += sum(token_costs[cursor:best])
        cursor = best

    chunks.append(_join_tokens(tokens[cursor:]))
    while len(chunks) < len(items):
        chunks.append("")
    return chunks[: len(items)]


def apply_translated_text_map(payload: list[dict], translated: dict) -> None:
    refresh_payload_translation_units(payload)
    group_items: dict[str, list[dict]] = {}
    for item in payload:
        unit_id = effective_translation_unit_id(item)
        if is_group_unit_id(unit_id):
            group_items.setdefault(unit_id, []).append(item)

    for item_id, protected_translated_text in translated.items():
        if not is_group_unit_id(item_id):
            continue
        items = group_items.get(item_id, [])
        if not items:
            continue
        raw_result = protected_translated_text
        metadata = _extract_result_metadata(raw_result)
        decision, protected_translated_text = _normalize_result_entry(raw_result)
        if decision == "keep_origin":
            for item in items:
                _mark_keep_origin(item)
                diagnostics = _result_diagnostics_for_item(metadata, item)
                if diagnostics:
                    item["translation_diagnostics"] = diagnostics
            continue
        formula_map = items[0].get("translation_unit_formula_map") or items[0].get("group_formula_map", [])
        protected_map = items[0].get("translation_unit_protected_map") or items[0].get("group_protected_map") or formula_map
        restored = restore_protected_tokens(protected_translated_text, protected_map)
        member_chunks = _split_group_protected_translation(protected_translated_text, items)
        for item, member_protected_text in zip(items, member_chunks):
            if not item.get("should_translate", True):
                clear_translation_fields(item)
                continue
            item["translation_unit_protected_translated_text"] = protected_translated_text
            item["translation_unit_translated_text"] = restored
            item["group_protected_translated_text"] = protected_translated_text
            item["group_translated_text"] = restored
            item["protected_translated_text"] = member_protected_text
            item["translated_text"] = restore_protected_tokens(member_protected_text, protected_map)
            diagnostics = _result_diagnostics_for_item(metadata, item)
            if diagnostics:
                item["translation_diagnostics"] = diagnostics
            item["final_status"] = str(metadata.get("final_status", "") or "translated")

    for item in payload:
        item_id = item.get("item_id")
        if item_id not in translated:
            continue
        raw_result = translated[item_id]
        metadata = _extract_result_metadata(raw_result)
        decision, protected_translated_text = _normalize_result_entry(raw_result)
        if decision == "keep_origin":
            _mark_keep_origin(item)
            diagnostics = _result_diagnostics_for_item(metadata, item)
            if diagnostics:
                item["translation_diagnostics"] = diagnostics
            continue
        item["translation_unit_protected_translated_text"] = protected_translated_text
        item["translation_unit_translated_text"] = restore_protected_tokens(
            protected_translated_text,
            item.get("translation_unit_protected_map")
            or item.get("translation_unit_formula_map")
            or item.get("protected_map")
            or item.get("formula_map", []),
        )
        if str(item.get("mixed_literal_action", "") or "") == "translate_tail":
            prefix = str(item.get("mixed_literal_prefix", "") or "")
            item["translation_unit_protected_translated_text"] = _join_prefix_and_tail(
                prefix,
                item["translation_unit_protected_translated_text"],
            )
            item["translation_unit_translated_text"] = _join_prefix_and_tail(
                prefix,
                item["translation_unit_translated_text"],
            )
        item["protected_translated_text"] = protected_translated_text
        item["translated_text"] = restore_protected_tokens(
            protected_translated_text,
            item.get("protected_map") or item.get("formula_map", []),
        )
        if str(item.get("mixed_literal_action", "") or "") == "translate_tail":
            prefix = str(item.get("mixed_literal_prefix", "") or "")
            item["protected_translated_text"] = _join_prefix_and_tail(prefix, item["protected_translated_text"])
            item["translated_text"] = _join_prefix_and_tail(prefix, item["translated_text"])
        diagnostics = _result_diagnostics_for_item(metadata, item)
        if diagnostics:
            item["translation_diagnostics"] = diagnostics
        item["final_status"] = str(metadata.get("final_status", "") or "translated")
