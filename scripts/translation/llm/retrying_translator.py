from collections import Counter
import re
import json
import time

from .cache import split_cached_batch
from .cache import store_cached_batch
from .deepseek_client import build_messages
from .deepseek_client import build_single_item_fallback_messages
from .deepseek_client import extract_json_text
from .deepseek_client import extract_single_item_translation_text
from .deepseek_client import request_chat_content
from translation.policy.metadata_filter import looks_like_nontranslatable_metadata
from translation.policy.metadata_filter import looks_like_url_fragment
from translation.policy.metadata_filter import should_skip_metadata_fragment


PLACEHOLDER_RE = re.compile(r"\[\[FORMULA_\d+]]")
EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
KEEP_ORIGIN_LABEL = "keep_origin"
INTERNAL_PLACEHOLDER_DEGRADED_REASON = "placeholder_unstable"
SHORT_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")
TAGGED_ITEM_RE = re.compile(
    r"<<<ITEM\s+item_id=(?P<item_id>[^\s>]+)(?:\s+decision=(?P<decision>[A-Za-z_-]+))?\s*>>>\s*"
    r"(?P<content>.*?)"
    r"\s*<<<END>>>",
    re.DOTALL,
)
TAGGED_SEGMENT_RE = re.compile(
    r"<<<SEG(?:MENT)?(?:\s+id=|\s+)(?P<segment_id>\d+)\s*>>>\s*"
    r"(?P<content>.*?)"
    r"\s*<<<END>>>",
    re.DOTALL,
)
MAX_FORMULA_SEGMENT_COUNT = 16


class SuspiciousKeepOriginError(ValueError):
    def __init__(self, item_id: str, result: dict[str, dict[str, str]]) -> None:
        super().__init__(f"{item_id}: suspicious keep_origin for long English body text")
        self.item_id = item_id
        self.result = result


class UnexpectedPlaceholderError(ValueError):
    def __init__(self, item_id: str, unexpected: list[str]) -> None:
        super().__init__(f"{item_id}: unexpected placeholders in translation: {unexpected}")
        self.item_id = item_id
        self.unexpected = unexpected


class PlaceholderInventoryError(ValueError):
    def __init__(self, item_id: str, source_sequence: list[str], translated_sequence: list[str]) -> None:
        super().__init__(
            f"{item_id}: placeholder inventory mismatch: source={source_sequence} translated={translated_sequence}"
        )
        self.item_id = item_id
        self.source_sequence = source_sequence
        self.translated_sequence = translated_sequence


class SegmentTranslationFormatError(ValueError):
    pass


def _normalize_decision(value: str) -> str:
    normalized = (value or "translate").strip().lower().replace("-", "_")
    if normalized in {"keep", "skip", "no_translate", "keeporigin"}:
        return KEEP_ORIGIN_LABEL
    if normalized == KEEP_ORIGIN_LABEL:
        return KEEP_ORIGIN_LABEL
    return "translate"


def _result_entry(decision: str, translated_text: str) -> dict[str, str]:
    normalized_decision = _normalize_decision(decision)
    return {
        "decision": normalized_decision,
        "translated_text": "" if normalized_decision == KEEP_ORIGIN_LABEL else (translated_text or "").strip(),
    }


def _internal_keep_origin_result(reason: str) -> dict[str, str]:
    result = _result_entry(KEEP_ORIGIN_LABEL, "")
    result["_internal_reason"] = reason
    return result


def _is_internal_placeholder_degraded(payload: dict[str, str]) -> bool:
    return str(payload.get("_internal_reason", "") or "") == INTERNAL_PLACEHOLDER_DEGRADED_REASON


def _parse_translation_payload(content: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for match in TAGGED_ITEM_RE.finditer(content or ""):
        item_id = (match.group("item_id") or "").strip()
        decision = match.group("decision") or "translate"
        translated_text = (match.group("content") or "").strip()
        if item_id:
            result[item_id] = _result_entry(decision, translated_text)
    if result:
        return result

    payload = json.loads(extract_json_text(content))
    translations = payload.get("translations", [])
    for item in translations:
        item_id = item.get("item_id")
        translated_text = item.get("translated_text", "")
        decision = item.get("decision", "translate")
        if item_id:
            result[item_id] = _result_entry(decision, translated_text)
    return result


def _segment_translation_system_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "You are translating fixed text segments extracted from one scientific OCR item.\n"
        "Each segment is a natural-language span that sits between protected formulas or literal tokens.\n"
        "Those protected formulas/literals are omitted from the request and will be reinserted automatically by software after translation.\n"
        "You are NOT translating the whole item as one sentence. You are translating each provided segment independently while respecting the original segment order.\n"
        "Use concise publication-style Simplified Chinese suitable for scientific writing.\n"
        "Keep abbreviations, symbols, and standard model names in their normal technical form.\n"
        "If a segment is only a connector or incomplete phrase, keep it equally short and incomplete in Chinese.\n"
        "Do not repair truncated grammar by pulling content from neighboring segments.\n"
        "Do not output any formula placeholders, formula markers, reconstructed full-item text, commentary, JSON, or code fences.\n"
        "Return exactly one tagged block for every requested segment_id and nothing else.\n"
        "Use this exact format:\n"
        "<<<SEG id=SEGMENT_ID>>>\n"
        "translated segment\n"
        "<<<END>>>\n"
        "Hard rules:\n"
        "- Every requested segment_id must appear exactly once.\n"
        "- Do not merge, split, omit, renumber, reorder, or invent segments.\n"
        "- Do not copy hidden formulas back into the output in any form.\n"
        "- Short connectors such as 'and', 'for', 'with', or 'by considering the possible' must stay terse rather than expanded into full sentences."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    return prompt


def _normalize_inline_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _segment_context_text(text: str, *, limit: int = 280) -> str:
    cleaned = _normalize_inline_whitespace(_strip_placeholders(text))
    if not cleaned:
        return ""
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: max(0, limit - 1)].rstrip()}…"


def _segment_structure_outline(skeleton: list[tuple[str, str]]) -> list[str]:
    outline: list[str] = []
    for kind, value in skeleton:
        if kind == "segment":
            outline.append(f"segment:{value}")
        elif kind == "placeholder":
            outline.append("formula")
        elif kind == "literal":
            literal = _normalize_inline_whitespace(value)
            if literal:
                outline.append(f"literal:{literal}")
    return outline


def _segment_needs_translation(text: str) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return False
    return any(ch.isalpha() for ch in normalized)


def _build_formula_segment_plan(source_text: str) -> tuple[list[tuple[str, str]], list[dict[str, str]]]:
    skeleton: list[tuple[str, str]] = []
    segments: list[dict[str, str]] = []
    cursor = 0
    for match in PLACEHOLDER_RE.finditer(source_text or ""):
        text = (source_text or "")[cursor : match.start()]
        if text:
            if _segment_needs_translation(text):
                segment_id = str(len(segments) + 1)
                segments.append({"segment_id": segment_id, "source_text": text.strip()})
                skeleton.append(("segment", segment_id))
            else:
                skeleton.append(("literal", text))
        skeleton.append(("placeholder", match.group(0)))
        cursor = match.end()
    tail = (source_text or "")[cursor:]
    if tail:
        if _segment_needs_translation(tail):
            segment_id = str(len(segments) + 1)
            segments.append({"segment_id": segment_id, "source_text": tail.strip()})
            skeleton.append(("segment", segment_id))
        else:
            skeleton.append(("literal", tail))
    return skeleton, segments


def _build_formula_segment_messages(
    item: dict,
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    domain_guidance: str = "",
) -> list[dict[str, str]]:
    serialized_segments = [
        {
            "segment_id": segment["segment_id"],
            "source_text": segment["source_text"],
        }
        for segment in segments
    ]
    user_payload: dict[str, object] = {
        "item_id": item["item_id"],
        "segment_count": len(serialized_segments),
        "segment_structure": _segment_structure_outline(skeleton),
        "segments": serialized_segments,
    }
    context_before = _segment_context_text(str(item.get("continuation_prev_text", "") or ""))
    context_after = _segment_context_text(str(item.get("continuation_next_text", "") or ""))
    if context_before:
        user_payload["context_before"] = context_before
    if context_after:
        user_payload["context_after"] = context_after
    if item.get("continuation_group"):
        user_payload["continuation_group"] = item["continuation_group"]
    return [
        {"role": "system", "content": _segment_translation_system_prompt(domain_guidance=domain_guidance)},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def _parse_segment_translation_payload(
    content: str,
    *,
    expected_segments: list[dict[str, str]],
) -> dict[str, str]:
    expected_ids = {segment["segment_id"] for segment in expected_segments}
    source_by_id = {segment["segment_id"]: segment["source_text"] for segment in expected_segments}
    result: dict[str, str] = {}
    for match in TAGGED_SEGMENT_RE.finditer(content or ""):
        segment_id = (match.group("segment_id") or "").strip()
        translated_text = (match.group("content") or "").strip()
        if segment_id in result:
            raise SegmentTranslationFormatError(f"duplicate segment_id: {segment_id}")
        if segment_id:
            result[segment_id] = translated_text
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise SegmentTranslationFormatError(f"segment_id mismatch: missing={missing} extra={extra}")
    for segment_id, translated_text in result.items():
        if not translated_text and source_by_id.get(segment_id, "").strip():
            raise SegmentTranslationFormatError(f"empty translated segment: {segment_id}")
        if PLACEHOLDER_RE.search(translated_text):
            raise SegmentTranslationFormatError(f"unexpected placeholder in segment output: {segment_id}")
    return result


def _rebuild_formula_segment_translation(
    skeleton: list[tuple[str, str]],
    translated_segments: dict[str, str],
) -> str:
    parts: list[str] = []
    for kind, value in skeleton:
        if kind == "segment":
            parts.append((translated_segments.get(value, "") or "").strip())
        else:
            parts.append(value)
    rebuilt = "".join(parts)
    rebuilt = re.sub(r"[ \t]{2,}", " ", rebuilt)
    rebuilt = re.sub(r"\s+([,.;:!?])", r"\1", rebuilt)
    return rebuilt.strip()


def _placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(text or ""))


def _placeholder_sequence(text: str) -> list[str]:
    return PLACEHOLDER_RE.findall(text or "")


def _repair_safe_duplicate_placeholders(source_text: str, translated_text: str) -> str | None:
    source_sequence = _placeholder_sequence(source_text)
    if not source_sequence:
        return None
    matches = list(PLACEHOLDER_RE.finditer(translated_text or ""))
    if not matches:
        return None
    translated_sequence = [match.group(0) for match in matches]
    if translated_sequence == source_sequence or len(translated_sequence) <= len(source_sequence):
        return None
    source_inventory = Counter(source_sequence)
    translated_inventory = Counter(translated_sequence)
    for placeholder, count in translated_inventory.items():
        if count < source_inventory.get(placeholder, 0):
            return None
    if any(placeholder not in source_inventory for placeholder in translated_inventory):
        return None

    kept_match_indexes: list[int] = []
    cursor = 0
    for placeholder in source_sequence:
        while cursor < len(translated_sequence) and translated_sequence[cursor] != placeholder:
            cursor += 1
        if cursor >= len(translated_sequence):
            return None
        kept_match_indexes.append(cursor)
        cursor += 1

    if len(kept_match_indexes) == len(matches):
        return None

    keep_set = set(kept_match_indexes)
    rebuilt_parts: list[str] = []
    prev_end = 0
    for index, match in enumerate(matches):
        rebuilt_parts.append(translated_text[prev_end:match.start()])
        if index in keep_set:
            rebuilt_parts.append(match.group(0))
        prev_end = match.end()
    rebuilt_parts.append(translated_text[prev_end:])

    repaired_text = "".join(rebuilt_parts)
    repaired_text = re.sub(r"[ \t]{2,}", " ", repaired_text)
    repaired_text = re.sub(r"\s+([,.;:!?])", r"\1", repaired_text)
    if _placeholder_sequence(repaired_text) != source_sequence:
        return None
    return repaired_text.strip()


def _has_formula_placeholders(item: dict) -> bool:
    return bool(_placeholders(_unit_source_text(item)))


def _should_use_formula_segment_translation(item: dict) -> bool:
    if not _has_formula_placeholders(item):
        return False
    _, segments = _build_formula_segment_plan(_unit_source_text(item))
    return bool(segments) and len(segments) <= MAX_FORMULA_SEGMENT_COUNT


def _placeholder_alias_maps(item: dict) -> tuple[dict[str, str], dict[str, str]]:
    source_sequence = _placeholder_sequence(_unit_source_text(item))
    original_to_alias: dict[str, str] = {}
    alias_to_original: dict[str, str] = {}
    for index, placeholder in enumerate(dict.fromkeys(source_sequence), start=1):
        alias = f"[[FORMULA_{1000 + index * 137}]]"
        original_to_alias[placeholder] = alias
        alias_to_original[alias] = placeholder
    return original_to_alias, alias_to_original


def _replace_placeholders(text: str, mapping: dict[str, str]) -> str:
    replaced = text or ""
    for source, target in mapping.items():
        replaced = replaced.replace(source, target)
    return replaced


def _item_with_placeholder_aliases(item: dict, mapping: dict[str, str]) -> dict:
    aliased = dict(item)
    for key in (
        "source_text",
        "protected_source_text",
        "mixed_original_protected_source_text",
        "translation_unit_protected_source_text",
        "group_protected_source_text",
    ):
        if key in aliased and aliased.get(key):
            aliased[key] = _replace_placeholders(str(aliased.get(key) or ""), mapping)
    return aliased


def _restore_placeholder_aliases(result: dict[str, dict[str, str]], mapping: dict[str, str]) -> dict[str, dict[str, str]]:
    restored: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        translated_text = _replace_placeholders(str(payload.get("translated_text", "") or ""), mapping)
        restored[item_id] = _result_entry(str(payload.get("decision", "translate") or "translate"), translated_text)
    return restored


def _placeholder_stability_guidance(item: dict, source_sequence: list[str]) -> str:
    if not source_sequence:
        return ""
    return (
        "Placeholder safety rules for this item:\n"
        f"- Allowed placeholders exactly: {', '.join(source_sequence)}\n"
        f"- Placeholder sequence in source_text: {' -> '.join(source_sequence)}\n"
        "- Keep placeholders as atomic tokens.\n"
        "- Do not invent, renumber, duplicate, omit, split, or reorder placeholders.\n"
        "- If a placeholder stands for a whole formula or expression, keep that placeholder as one unit."
    )


def _unit_source_text(item: dict) -> str:
    return (
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def _strip_placeholders(text: str) -> str:
    return PLACEHOLDER_RE.sub(" ", text or "")


def _looks_like_english_prose(text: str) -> bool:
    cleaned = _strip_placeholders(text).strip()
    if not cleaned:
        return False
    if "@" in cleaned or "http://" in cleaned or "https://" in cleaned or looks_like_url_fragment(cleaned):
        return False
    if _looks_like_reference_entry(cleaned):
        return False
    words = EN_WORD_RE.findall(cleaned)
    if len(words) < 8:
        return False
    alpha_chars = sum(ch.isalpha() for ch in cleaned)
    if alpha_chars < 30:
        return False
    return True


def _looks_like_reference_entry(text: str) -> bool:
    cleaned = _strip_placeholders(text)
    if not re.search(r"\b(?:19|20)\d{2}\b", cleaned):
        return False
    if not re.search(r"\b(?:doi|journal|vol\.|volume|no\.|pp\.|pages?|proceedings|conference|springer|elsevier|acm|ieee)\b", cleaned, re.I):
        return False
    return cleaned.count(",") >= 2 or bool(re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\b", cleaned))


def _looks_like_short_fragment(text: str) -> bool:
    stripped = text.strip()
    if not stripped or " " in stripped:
        return False
    return bool(SHORT_FRAGMENT_RE.fullmatch(stripped))


def _looks_like_garbled_fragment(text: str) -> bool:
    cleaned = _strip_placeholders(text).strip()
    if not cleaned:
        return True
    if "\ufffd" in cleaned:
        return True
    visible = [ch for ch in cleaned if not ch.isspace()]
    if not visible:
        return True
    weird = sum(1 for ch in visible if not (ch.isalnum() or ch in ".,;:!?()[]{}'\"-_/+*&%$#=@"))
    return weird / max(1, len(visible)) > 0.35


def _should_force_translate_body_text(item: dict) -> bool:
    source_text = _unit_source_text(item).strip()
    if not source_text:
        return False
    if should_skip_metadata_fragment(item):
        return False
    if looks_like_nontranslatable_metadata(item):
        return False
    if _looks_like_reference_entry(source_text):
        return False
    if _looks_like_garbled_fragment(source_text):
        return False
    if _looks_like_short_fragment(source_text):
        return False
    if str(item.get("block_type", "") or "") != "text":
        return False
    structure_role = str((item.get("metadata", {}) or {}).get("structure_role", "") or "")
    if structure_role and structure_role != "body":
        return False
    words = EN_WORD_RE.findall(_strip_placeholders(source_text))
    if item.get("continuation_group"):
        return len(words) >= 6 and _looks_like_english_prose(source_text)
    if item.get("block_type") == "text" and bool(item.get("formula_map") or item.get("translation_unit_formula_map")):
        return len(words) >= 5 and _looks_like_english_prose(source_text)
    return _looks_like_english_prose(source_text) and len(words) >= 8


def _should_reject_keep_origin(item: dict, decision: str, payload: dict[str, str] | None = None) -> bool:
    if decision != KEEP_ORIGIN_LABEL:
        return False
    if payload and _is_internal_placeholder_degraded(payload):
        return False
    block_type = item.get("block_type")
    if block_type not in {"", None, "text"}:
        return False
    return _should_force_translate_body_text(item)


def _canonicalize_batch_result(batch: list[dict], result: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    batch_items = {str(item.get("item_id", "") or ""): item for item in batch}
    canonical: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        item = batch_items.get(item_id)
        decision = _normalize_decision(str(payload.get("decision", "translate") or "translate"))
        translated_text = str(payload.get("translated_text", "") or "").strip()
        if item is not None:
            source_text = _unit_source_text(item).strip()
            if decision != KEEP_ORIGIN_LABEL and translated_text:
                repaired_text = _repair_safe_duplicate_placeholders(source_text, translated_text)
                if repaired_text is not None:
                    translated_text = repaired_text
            if (
                decision != KEEP_ORIGIN_LABEL
                and translated_text
                and translated_text == source_text
                and not _should_force_translate_body_text(item)
            ):
                decision = KEEP_ORIGIN_LABEL
                translated_text = ""
        canonical[item_id] = _result_entry(decision, translated_text)
    return canonical


def _validate_batch_result(batch: list[dict], result: dict[str, dict[str, str]]) -> None:
    expected_ids = {item["item_id"] for item in batch}
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise ValueError(f"translation item_id mismatch: missing={missing} extra={extra}")

    for item in batch:
        item_id = item["item_id"]
        source_text = _unit_source_text(item)
        translated_result = result.get(item_id, {})
        translated_text = translated_result.get("translated_text", "")
        decision = _normalize_decision(translated_result.get("decision", "translate"))
        if _should_reject_keep_origin(item, decision, translated_result):
            raise SuspiciousKeepOriginError(item_id, result)
        if decision == KEEP_ORIGIN_LABEL:
            continue
        source_placeholders = _placeholders(source_text)
        translated_placeholders = _placeholders(translated_text)
        if not translated_placeholders.issubset(source_placeholders):
            unexpected = sorted(translated_placeholders - source_placeholders)
            raise UnexpectedPlaceholderError(item_id, unexpected)
        source_sequence = _placeholder_sequence(source_text)
        translated_sequence = _placeholder_sequence(translated_text)
        if Counter(translated_sequence) != Counter(source_sequence):
            raise PlaceholderInventoryError(item_id, source_sequence, translated_sequence)
        if translated_text.strip() == source_text.strip():
            if looks_like_url_fragment(source_text):
                continue
            if _looks_like_reference_entry(source_text):
                continue
            if looks_like_nontranslatable_metadata(item):
                continue
            if _looks_like_english_prose(source_text):
                raise ValueError(f"{item_id}: translation unchanged from English source")


def _translate_single_item_plain_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_single_item_fallback_messages(
            item,
            domain_guidance=domain_guidance,
            mode=mode,
            structured_decision=False,
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=120,
        request_label=request_label,
    )
    translated_text = extract_single_item_translation_text(content, item["item_id"])
    return {item["item_id"]: _result_entry("translate", translated_text)}


def _translate_single_item_tagged_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_messages([item], domain_guidance=domain_guidance, mode="fast"),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=120,
        request_label=request_label,
    )
    result = _parse_translation_payload(content)
    result = _canonicalize_batch_result([item], result)
    _validate_batch_result([item], result)
    return result


def _translate_single_item_stable_placeholder_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, dict[str, str]]:
    original_to_alias, alias_to_original = _placeholder_alias_maps(item)
    aliased_item = _item_with_placeholder_aliases(item, original_to_alias)
    aliased_sequence = _placeholder_sequence(_unit_source_text(aliased_item))
    stability_guidance = _placeholder_stability_guidance(aliased_item, aliased_sequence)
    merged_guidance = "\n\n".join(part for part in [domain_guidance.strip(), stability_guidance.strip()] if part)
    result = _translate_single_item_tagged_text(
        aliased_item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=merged_guidance,
    )
    restored = _restore_placeholder_aliases(result, alias_to_original)
    restored = _canonicalize_batch_result([item], restored)
    _validate_batch_result([item], restored)
    return restored


def _translate_single_item_formula_segment_text_with_retries(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, dict[str, str]]:
    source_text = _unit_source_text(item)
    skeleton, segments = _build_formula_segment_plan(source_text)
    if not segments:
        raise SegmentTranslationFormatError(f"{item['item_id']}: no translatable formula segments")
    if len(segments) > MAX_FORMULA_SEGMENT_COUNT:
        raise SegmentTranslationFormatError(
            f"{item['item_id']}: too many formula segments ({len(segments)} > {MAX_FORMULA_SEGMENT_COUNT})"
        )

    last_error: Exception | None = None
    for attempt in range(1, 5):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: segmented-formula attempt {attempt}/4 segments={len(segments)}",
                    flush=True,
                )
            content = request_chat_content(
                _build_formula_segment_messages(
                    item,
                    skeleton,
                    segments,
                    domain_guidance=domain_guidance,
                ),
                api_key=api_key,
                model=model,
                base_url=base_url,
                temperature=0.0,
                response_format=None,
                timeout=120,
                request_label=f"{request_label} seg#{attempt}" if request_label else "",
            )
            translated_segments = _parse_segment_translation_payload(content, expected_segments=segments)
            rebuilt_text = _rebuild_formula_segment_translation(skeleton, translated_segments)
            result = {item["item_id"]: _result_entry("translate", rebuilt_text)}
            result = _canonicalize_batch_result([item], result)
            _validate_batch_result([item], result)
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: segmented-formula ok in {elapsed:.2f}s", flush=True)
            return result
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: segmented-formula failed attempt {attempt}/4 after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= 4:
                raise
            time.sleep(min(8, 2 * attempt))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Segmented formula translation failed without an exception.")


def _translate_single_item_plain_text_with_retries(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    if _should_use_formula_segment_translation(item):
        try:
            return _translate_single_item_formula_segment_text_with_retries(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                domain_guidance=domain_guidance,
            )
        except Exception as exc:
            if request_label:
                print(
                    f"{request_label}: segmented-formula route failed, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )
    last_error: Exception | None = None
    for attempt in range(1, 5):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: plain-text attempt {attempt}/4 item={item['item_id']}",
                    flush=True,
                )
            result = _translate_single_item_plain_text(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=domain_guidance,
                mode=mode,
            )
            result = _canonicalize_batch_result([item], result)
            _validate_batch_result([item], result)
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: plain-text ok in {elapsed:.2f}s", flush=True)
            return result
        except (UnexpectedPlaceholderError, PlaceholderInventoryError) as exc:
            last_error = exc
            elapsed = time.perf_counter() - started
            if request_label:
                print(
                    f"{request_label}: plain-text placeholder failed attempt {attempt}/4 after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if _has_formula_placeholders(item):
                tagged_started = time.perf_counter()
                try:
                    if request_label:
                        print(
                            f"{request_label}: retrying with tagged single-item format for placeholder stability",
                            flush=True,
                        )
                    result = _translate_single_item_stable_placeholder_text(
                        item,
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        request_label=f"{request_label} tagged" if request_label else "",
                        domain_guidance=domain_guidance,
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
                            f"{request_label}: tagged single-item failed attempt {attempt}/4 after {tagged_elapsed:.2f}s: {type(tagged_exc).__name__}: {tagged_exc}",
                            flush=True,
                        )
            if attempt >= 4:
                if _has_formula_placeholders(item):
                    if request_label:
                        print(
                            f"{request_label}: degraded to keep_origin after repeated placeholder instability",
                            flush=True,
                        )
                    return {item["item_id"]: _internal_keep_origin_result(INTERNAL_PLACEHOLDER_DEGRADED_REASON)}
                raise last_error
            time.sleep(min(8, 2 * attempt))
        except SuspiciousKeepOriginError as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: unexpected keep_origin after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= 4:
                raise
            time.sleep(min(8, 2 * attempt))
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: plain-text parse failed attempt {attempt}/4 after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= 4:
                raise
            time.sleep(min(8, 2 * attempt))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Plain-text translation failed without an exception.")


def _translate_items_plain_text(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    cached_result, uncached_batch = split_cached_batch(
        batch,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
    )
    if request_label and cached_result:
        print(
            f"{request_label}: plain-text cache hit {len(cached_result)}/{len(batch)}",
            flush=True,
        )
    valid_cached: dict[str, dict[str, str]] = {}
    validated_uncached = list(uncached_batch)
    for item in batch:
        item_id = item["item_id"]
        cached_item_result = cached_result.get(item_id)
        if not cached_item_result:
            continue
        try:
            canonical = _canonicalize_batch_result([item], {item_id: cached_item_result})
            _validate_batch_result([item], canonical)
            valid_cached.update(canonical)
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
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
    total_items = len(uncached_batch)
    for index, item in enumerate(uncached_batch, start=1):
        item_label = (
            f"{request_label} item {index}/{total_items} {item['item_id']}"
            if request_label
            else ""
        )
        result = _translate_single_item_plain_text_with_retries(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=item_label,
            domain_guidance=domain_guidance,
            mode=mode,
        )
        payload = result.get(item["item_id"], {})
        if not _is_internal_placeholder_degraded(payload):
            store_cached_batch(
                [item],
                result,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                mode=mode,
            )
        merged.update(result)
    return merged


def _translate_single_item_with_decision(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_single_item_fallback_messages(
            item,
            domain_guidance=domain_guidance,
            mode=mode,
            structured_decision=True,
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=120,
        request_label=request_label,
    )
    result = _parse_translation_payload(content)
    result = _canonicalize_batch_result([item], result)
    _validate_batch_result([item], result)
    return result


def _translate_batch_once(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_messages(batch, domain_guidance=domain_guidance, mode=mode),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.2,
        response_format=None,
        timeout=120,
        request_label=request_label,
    )
    result = _parse_translation_payload(content)
    result = _canonicalize_batch_result(batch, result)
    _validate_batch_result(batch, result)
    return result


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    return _translate_items_plain_text(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        mode=mode,
    )


def translate_items_to_text_map(
    items: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, str]:
    translated = translate_batch(
        items,
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
    )
    return {item_id: result.get("translated_text", "") for item_id, result in translated.items()}
