from __future__ import annotations

import json
import re
import time

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.control_context import SegmentationPolicy
from services.translation.llm.deepseek_client import request_chat_content
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import has_formula_placeholders
from services.translation.llm.placeholder_guard import normalize_inline_whitespace
from services.translation.llm.placeholder_guard import placeholder_sequence
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import strip_placeholders
from services.translation.llm.placeholder_guard import unit_source_text
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.structured_models import FORMULA_SEGMENT_RESPONSE_SCHEMA


TAGGED_SEGMENT_RE = re.compile(
    r"<<<SEG(?:MENT)?(?:\s+id=|\s+)(?P<segment_id>\d+)\s*>>>\s*"
    r"(?P<content>.*?)"
    r"\s*<<<END>>>",
    re.DOTALL,
)

_OPTIONAL_CONNECTOR_SEGMENTS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "per",
    "than",
    "to",
    "via",
    "vs",
    "with",
}

_SMALL_INLINE_TRIGGER_PHRASES = (
    "abbreviated as",
    "defined as",
    "denoted as",
    "is defined as",
    "can be defined as",
    "where ",
)

_SMALL_INLINE_SUPPORT_PHRASES = (
    "represented by",
    "expressed as",
    "written as",
    "calculated as",
    "corresponds to",
    "refers to",
    "stands for",
)


class SegmentTranslationFormatError(ValueError):
    pass


class SegmentTranslationParseError(SegmentTranslationFormatError):
    pass


class SegmentTranslationSemanticError(SegmentTranslationFormatError):
    pass


def _is_optional_empty_segment(source_text: str) -> bool:
    normalized = normalize_inline_whitespace(source_text).strip().lower()
    if not normalized:
        return True
    if len(normalized) > 12:
        return False
    words = re.findall(r"[a-z]+", normalized)
    if not words or len(words) > 2:
        return False
    if " ".join(words) != normalized:
        return False
    return all(word in _OPTIONAL_CONNECTOR_SEGMENTS for word in words)


def segment_context_text(text: str, *, limit: int = 280) -> str:
    cleaned = normalize_inline_whitespace(strip_placeholders(text))
    if not cleaned:
        return ""
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: max(0, limit - 1)].rstrip()}…"


def merge_segment_contexts(*texts: str, limit: int = 280) -> str:
    merged = " ".join(part.strip() for part in texts if part and part.strip())
    return segment_context_text(merged, limit=limit)


def segment_structure_outline(skeleton: list[tuple[str, str]]) -> list[str]:
    outline: list[str] = []
    for kind, value in skeleton:
        if kind == "segment":
            outline.append(f"segment:{value}")
        elif kind == "placeholder":
            outline.append("formula")
        elif kind == "literal":
            literal = normalize_inline_whitespace(value)
            if literal:
                outline.append(f"literal:{literal}")
    return outline


def segment_needs_translation(text: str) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return False
    return any(ch.isalpha() for ch in normalized)


def build_formula_segment_plan(source_text: str) -> tuple[list[tuple[str, str]], list[dict[str, str]]]:
    skeleton: list[tuple[str, str]] = []
    segments: list[dict[str, str]] = []
    cursor = 0
    for match in re.finditer(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", source_text or ""):
        text = (source_text or "")[cursor : match.start()]
        if text:
            if segment_needs_translation(text):
                segment_id = str(len(segments) + 1)
                segments.append({"segment_id": segment_id, "source_text": text.strip()})
                skeleton.append(("segment", segment_id))
            else:
                skeleton.append(("literal", text))
        skeleton.append(("placeholder", match.group(0)))
        cursor = match.end()
    tail = (source_text or "")[cursor:]
    if tail:
        if segment_needs_translation(tail):
            segment_id = str(len(segments) + 1)
            segments.append({"segment_id": segment_id, "source_text": tail.strip()})
            skeleton.append(("segment", segment_id))
        else:
            skeleton.append(("literal", tail))
    return skeleton, segments


def segment_translation_system_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "You are translating fixed text segments extracted from one scientific OCR item.\n"
        "Each segment is a natural-language span that sits between protected formulas or literal tokens.\n"
        "Those protected formulas/literals are omitted from the request and will be reinserted automatically by software after translation.\n"
        "You are NOT translating the whole item as one sentence. You are translating each provided segment independently while respecting the original segment order.\n"
        "Use concise publication-style Simplified Chinese suitable for scientific writing.\n"
        "Keep abbreviations, symbols, and standard model names in their normal technical form.\n"
        "If a segment is only a connector or incomplete phrase, keep it equally short and incomplete in Chinese.\n"
        "Do not repair truncated grammar by pulling content from neighboring segments.\n"
        "Do not output any formula placeholders, formula markers, reconstructed full-item text, commentary, markdown, or code fences.\n"
        'Return only JSON matching {"segments":[{"segment_id":"1","translated_text":"..."}]}.\n'
        "Hard rules:\n"
        "- Every requested segment_id must appear exactly once.\n"
        "- Do not merge, split, omit, renumber, reorder, or invent segments.\n"
        "- Do not copy hidden formulas back into the output in any form.\n"
        "- Short connectors such as 'and', 'for', 'with', or 'by considering the possible' must stay terse rather than expanded into full sentences."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    return prompt


def segment_translation_tagged_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "You are translating fixed text segments extracted from one scientific OCR item.\n"
        "Each segment is an independent natural-language span between protected formulas or literals.\n"
        "Protected formulas are omitted and will be reinserted by software after translation.\n"
        "Translate each segment independently into concise publication-style Simplified Chinese.\n"
        "Do not merge, split, omit, reorder, or renumber segments.\n"
        "Do not output formulas, markdown, commentary, code fences, or reconstructed full-item text.\n"
        "Return one tagged block per segment using this exact format:\n"
        "<<<SEG id=1>>>\n"
        "translated text\n"
        "<<<END>>>\n"
        "Output one block for every requested segment_id exactly once."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    return prompt


def build_formula_segment_messages(
    item: dict,
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    domain_guidance: str = "",
    context_before: str | None = None,
    context_after: str | None = None,
    response_style: str = "tagged",
) -> list[dict[str, str]]:
    serialized_segments = [
        {"segment_id": segment["segment_id"], "source_text": segment["source_text"]}
        for segment in segments
    ]
    user_payload: dict[str, object] = {
        "item_id": item["item_id"],
        "segment_count": len(serialized_segments),
        "segment_structure": segment_structure_outline(skeleton),
        "segments": serialized_segments,
    }
    resolved_context_before = (
        context_before if context_before is not None else segment_context_text(str(item.get("continuation_prev_text", "") or ""))
    )
    resolved_context_after = (
        context_after if context_after is not None else segment_context_text(str(item.get("continuation_next_text", "") or ""))
    )
    if resolved_context_before:
        user_payload["context_before"] = resolved_context_before
    if resolved_context_after:
        user_payload["context_after"] = resolved_context_after
    if item.get("continuation_group"):
        user_payload["continuation_group"] = item["continuation_group"]
    system_prompt = (
        segment_translation_system_prompt(domain_guidance=domain_guidance)
        if response_style == "json"
        else segment_translation_tagged_prompt(domain_guidance=domain_guidance)
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def _request_formula_segment_translation(
    item: dict,
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    timeout_s: int,
    request_label: str,
    context_before: str | None = None,
    context_after: str | None = None,
) -> dict[str, str]:
    tagged_error: Exception | None = None
    tagged_request_label = f"{request_label} tagged" if request_label else ""
    try:
        content = request_chat_content(
            build_formula_segment_messages(
                item,
                skeleton,
                segments,
                domain_guidance=domain_guidance,
                context_before=context_before,
                context_after=context_after,
                response_style="tagged",
            ),
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=None,
            timeout=timeout_s,
            request_label=tagged_request_label,
        )
        return parse_segment_translation_payload(content, expected_segments=segments)
    except SegmentTranslationSemanticError:
        raise
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        tagged_error = exc

    content = request_chat_content(
        build_formula_segment_messages(
            item,
            skeleton,
            segments,
            domain_guidance=domain_guidance,
            context_before=context_before,
            context_after=context_after,
            response_style="json",
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=FORMULA_SEGMENT_RESPONSE_SCHEMA,
        timeout=timeout_s,
        request_label=f"{request_label} json" if request_label else "",
    )
    try:
        return parse_segment_translation_payload(content, expected_segments=segments)
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        if tagged_error is not None:
            raise SegmentTranslationFormatError(f"tagged_failed={tagged_error}; json_failed={exc}") from exc
        raise


def parse_segment_translation_payload(
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
    if not result:
        try:
            payload = json.loads(content)
        except Exception:
            try:
                payload = json.loads(re.search(r"\{.*\}", content or "", re.DOTALL).group(0))  # type: ignore[union-attr]
            except Exception as exc:
                raise SegmentTranslationParseError(f"segment payload is not valid tagged text or JSON: {exc}") from exc
        segments_payload = payload.get("segments", []) if isinstance(payload, dict) else []
        for item in segments_payload:
            if not isinstance(item, dict):
                continue
            segment_id = str(item.get("segment_id", "") or "").strip()
            translated_text = str(item.get("translated_text", "") or "").strip()
            if segment_id in result:
                raise SegmentTranslationFormatError(f"duplicate segment_id: {segment_id}")
            if segment_id:
                result[segment_id] = translated_text
    actual_ids = set(result)
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise SegmentTranslationParseError(f"segment_id mismatch: missing={missing} extra={extra}")
    for segment_id, translated_text in result.items():
        if not translated_text and source_by_id.get(segment_id, "").strip():
            if _is_optional_empty_segment(source_by_id.get(segment_id, "")):
                result[segment_id] = ""
                continue
            raise SegmentTranslationSemanticError(f"empty translated segment: {segment_id}")
        if re.search(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", translated_text):
            raise SegmentTranslationSemanticError(f"unexpected placeholder in segment output: {segment_id}")
    return result


def rebuild_formula_segment_translation(
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


def is_small_formula_inline_candidate(
    item: dict,
    *,
    policy: SegmentationPolicy | None = None,
) -> bool:
    if policy is None:
        policy = SegmentationPolicy()
    if not policy.small_formula_inline_enabled:
        return False
    if item.get("continuation_group"):
        return False
    source_text = unit_source_text(item)
    if not source_text:
        return False
    placeholder_count = len(re.findall(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]", source_text))
    if placeholder_count <= 0 or placeholder_count > policy.small_formula_inline_max_placeholders:
        return False
    normalized_chars = len(normalize_inline_whitespace(source_text))
    if normalized_chars < policy.small_formula_inline_min_chars or normalized_chars > policy.small_formula_inline_max_chars:
        return False
    skeleton, segments = build_formula_segment_plan(source_text)
    if not (0 < len(segments) <= policy.small_formula_inline_max_segments):
        return False
    return small_formula_risk_score(
        source_text,
        skeleton=skeleton,
        segments=segments,
        policy=policy,
    ) >= policy.small_formula_inline_score_threshold


def small_formula_risk_score(
    source_text: str,
    *,
    skeleton: list[tuple[str, str]] | None = None,
    segments: list[dict[str, str]] | None = None,
    policy: SegmentationPolicy | None = None,
) -> int:
    if policy is None:
        policy = SegmentationPolicy()
    lowered = normalize_inline_whitespace(strip_placeholders(source_text)).lower()
    resolved_skeleton = skeleton
    resolved_segments = segments
    if resolved_skeleton is None or resolved_segments is None:
        resolved_skeleton, resolved_segments = build_formula_segment_plan(source_text)
    score = 0
    if any(phrase in lowered for phrase in _SMALL_INLINE_TRIGGER_PHRASES):
        score += 3
    if any(phrase in lowered for phrase in _SMALL_INLINE_SUPPORT_PHRASES):
        score += 2
    segment_texts = [normalize_inline_whitespace(segment["source_text"]).strip().lower() for segment in resolved_segments]
    short_segments = [text for text in segment_texts if 0 < len(text) <= 32]
    if short_segments:
        score += 1
    if any(text.startswith(("the ", "a ", "an ")) and len(text) <= 24 for text in segment_texts[:1]):
        score += 1
    if any(text.startswith(("which ", "where ", "that ", "is ", "are ", "can ")) for text in segment_texts[1:]):
        score += 1
    if len(resolved_segments) >= 3:
        score += 1
    placeholder_indexes = [index for index, entry in enumerate(resolved_skeleton) if entry[0] == "placeholder"]
    if placeholder_indexes:
        if min(placeholder_indexes) <= 1:
            score += 1
        if max(placeholder_indexes) < len(resolved_skeleton) - 1:
            score += 1
    if ")" in source_text and any(phrase in lowered for phrase in ("abbreviated as", "stands for", "denoted as")):
        score += 1
    return score


def formula_segment_translation_route(item: dict, *, policy: SegmentationPolicy | None = None) -> str:
    if policy is None:
        policy = SegmentationPolicy()
    if not has_formula_placeholders(item):
        return "none"
    _, segments = build_formula_segment_plan(unit_source_text(item))
    if not segments:
        return "none"
    if is_small_formula_inline_candidate(item, policy=policy):
        return "small_inline"
    if policy.prefer_plain_when_segment_count_leq > 0 and len(segments) <= policy.prefer_plain_when_segment_count_leq:
        return "none"
    if len(segments) <= policy.max_formula_segment_count:
        return "single"
    return "windowed"


def formula_segment_window_count(item: dict, *, policy: SegmentationPolicy | None = None) -> int:
    if policy is None:
        policy = SegmentationPolicy()
    if not has_formula_placeholders(item):
        return 0
    skeleton, segments = build_formula_segment_plan(unit_source_text(item))
    if not segments:
        return 0
    return len(build_formula_segment_windows(skeleton, segments, policy=policy))


def window_neighbor_context(
    segments: list[dict[str, str]],
    start_index: int,
    end_index: int,
    *,
    direction: str,
    policy: SegmentationPolicy,
) -> str:
    if direction == "before":
        context_segments = segments[max(0, start_index - policy.formula_segment_window_neighbor_context) : start_index]
    else:
        context_segments = segments[
            end_index + 1 : end_index + 1 + policy.formula_segment_window_neighbor_context
        ]
    return segment_context_text(" ".join(segment["source_text"] for segment in context_segments))


def slice_formula_segment_skeleton(
    skeleton: list[tuple[str, str]],
    first_segment_id: str,
    last_segment_id: str,
) -> list[tuple[str, str]]:
    first_index = next(index for index, entry in enumerate(skeleton) if entry[0] == "segment" and entry[1] == first_segment_id)
    last_index = next(index for index, entry in enumerate(skeleton) if entry[0] == "segment" and entry[1] == last_segment_id)
    start = first_index
    while start > 0 and skeleton[start - 1][0] != "segment":
        start -= 1
    end = last_index
    while end + 1 < len(skeleton) and skeleton[end + 1][0] != "segment":
        end += 1
    return skeleton[start : end + 1]


def build_formula_segment_windows(
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    policy: SegmentationPolicy,
) -> list[dict[str, object]]:
    windows: list[dict[str, object]] = []
    index = 0
    while index < len(segments):
        start_index = index
        current_segments: list[dict[str, str]] = []
        current_chars = 0
        while index < len(segments):
            segment = segments[index]
            segment_chars = len(normalize_inline_whitespace(segment["source_text"]))
            if current_segments and (
                len(current_segments) >= policy.formula_segment_window_target_count
                or current_chars + segment_chars > policy.formula_segment_window_max_chars
            ):
                break
            current_segments.append(segment)
            current_chars += segment_chars
            index += 1
        if not current_segments:
            current_segments.append(segments[index])
            index += 1
        end_index = index - 1
        first_segment_id = current_segments[0]["segment_id"]
        last_segment_id = current_segments[-1]["segment_id"]
        windows.append(
            {
                "window_index": len(windows) + 1,
                "start_index": start_index,
                "end_index": end_index,
                "is_first_window": start_index == 0,
                "is_last_window": end_index >= len(segments) - 1,
                "segments": current_segments,
                "segment_range": f"{first_segment_id}-{last_segment_id}",
                "context_before": window_neighbor_context(segments, start_index, end_index, direction="before", policy=policy),
                "context_after": window_neighbor_context(segments, start_index, end_index, direction="after", policy=policy),
                "skeleton": slice_formula_segment_skeleton(skeleton, first_segment_id, last_segment_id),
            }
        )
    return windows


def translate_single_item_formula_segment_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    policy: SegmentationPolicy | None = None,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    attempt_limit: int = 4,
    timeout_s: int = 120,
) -> dict[str, dict[str, str]]:
    if policy is None:
        policy = SegmentationPolicy()
    source_text = unit_source_text(item)
    skeleton, segments = build_formula_segment_plan(source_text)
    if not segments:
        raise SegmentTranslationFormatError(f"{item['item_id']}: no translatable formula segments")
    if len(segments) > policy.max_formula_segment_count:
        raise SegmentTranslationFormatError(
            f"{item['item_id']}: too many formula segments ({len(segments)} > {policy.max_formula_segment_count})"
        )

    last_error: Exception | None = None
    for attempt in range(1, max(1, attempt_limit) + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(f"{request_label}: segmented-formula attempt {attempt}/{max(1, attempt_limit)} segments={len(segments)}", flush=True)
            translated_segments = _request_formula_segment_translation(
                item,
                skeleton,
                segments,
                api_key=api_key,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                timeout_s=timeout_s,
                request_label=f"{request_label} seg#{attempt}" if request_label else "",
            )
            rebuilt_text = rebuild_formula_segment_translation(skeleton, translated_segments)
            result = {item["item_id"]: result_entry("translate", rebuilt_text)}
            result = canonicalize_batch_result([item], result)
            validate_batch_result([item], result, diagnostics=diagnostics)
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: segmented-formula ok in {elapsed:.2f}s", flush=True)
            return result
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: segmented-formula failed attempt {attempt}/{max(1, attempt_limit)} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= max(1, attempt_limit):
                raise
            time.sleep(min(8, 2 * attempt))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Segmented formula translation failed without an exception.")


def translate_formula_segment_window_with_retries(
    item: dict,
    window: dict[str, object],
    *,
    total_windows: int,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    attempt_limit: int = 4,
    timeout_s: int = 120,
) -> dict[str, str]:
    window_index = int(window["window_index"])
    window_segments = list(window["segments"])
    window_range = str(window["segment_range"])
    context_before = str(window.get("context_before", "") or "")
    context_after = str(window.get("context_after", "") or "")
    if bool(window.get("is_first_window")):
        context_before = merge_segment_contexts(str(item.get("continuation_prev_text", "") or ""), context_before)
    if bool(window.get("is_last_window")):
        context_after = merge_segment_contexts(context_after, str(item.get("continuation_next_text", "") or ""))
    last_error: Exception | None = None
    for attempt in range(1, max(1, attempt_limit) + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: formula-window {window_index}/{total_windows} attempt {attempt}/{max(1, attempt_limit)} segments={len(window_segments)} range={window_range}",
                    flush=True,
                )
            translated_segments = _request_formula_segment_translation(
                item,
                list(window["skeleton"]),
                window_segments,
                api_key=api_key,
                model=model,
                base_url=base_url,
                domain_guidance=domain_guidance,
                timeout_s=timeout_s,
                request_label=f"{request_label} win{window_index}#{attempt}" if request_label else "",
                context_before=context_before,
                context_after=context_after,
            )
            if request_label:
                elapsed = time.perf_counter() - started
                print(f"{request_label}: formula-window {window_index}/{total_windows} ok in {elapsed:.2f}s", flush=True)
            return translated_segments
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if request_label:
                elapsed = time.perf_counter() - started
                print(
                    f"{request_label}: formula-window {window_index}/{total_windows} failed attempt {attempt}/{max(1, attempt_limit)} after {elapsed:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt >= max(1, attempt_limit):
                raise
            time.sleep(min(8, 2 * attempt))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Formula window translation failed without an exception.")


def translate_single_item_formula_segment_windows_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    policy: SegmentationPolicy | None = None,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    attempt_limit: int = 4,
    timeout_s: int = 120,
) -> dict[str, dict[str, str]]:
    if policy is None:
        policy = SegmentationPolicy()
    source_text = unit_source_text(item)
    skeleton, segments = build_formula_segment_plan(source_text)
    if not segments:
        raise SegmentTranslationFormatError(f"{item['item_id']}: no translatable formula segments")
    windows = build_formula_segment_windows(skeleton, segments, policy=policy)
    if len(windows) <= 1:
        translated_segments = translate_formula_segment_window_with_retries(
            item,
            windows[0],
            total_windows=1,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            domain_guidance=domain_guidance,
            attempt_limit=attempt_limit,
            timeout_s=timeout_s,
        )
        rebuilt_text = rebuild_formula_segment_translation(skeleton, translated_segments)
        result = {item["item_id"]: result_entry("translate", rebuilt_text)}
        result = canonicalize_batch_result([item], result)
        validate_batch_result([item], result, diagnostics=diagnostics)
        if request_label:
            print(f"{request_label}: single-window-formula rebuilt ok translated_windows=1/1", flush=True)
        return result

    if request_label:
        print(f"{request_label}: route=windowed-formula windows={len(windows)} segments={len(segments)}", flush=True)
    translated_segments: dict[str, str] = {}
    successful_windows = 0
    for window in windows:
        try:
            translated_segments.update(
                translate_formula_segment_window_with_retries(
                    item,
                    window,
                    total_windows=len(windows),
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_label=request_label,
                    domain_guidance=domain_guidance,
                    attempt_limit=attempt_limit,
                    timeout_s=timeout_s,
                )
            )
            successful_windows += 1
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            window_index = int(window["window_index"])
            window_range = str(window["segment_range"])
            if diagnostics is not None:
                diagnostics.emit(
                    kind="formula_window_degraded",
                    item_id=str(item.get("item_id", "") or ""),
                    page_idx=item.get("page_idx"),
                    severity="warning",
                    message=f"Formula window degraded to source for range {window_range}",
                    retryable=True,
                    details={"window_index": window_index, "segment_range": window_range},
                )
            if request_label:
                print(
                    f"{request_label}: formula-window {window_index}/{len(windows)} degraded to local keep_origin range={window_range}: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            for segment in list(window["segments"]):
                translated_segments[segment["segment_id"]] = segment["source_text"]

    if successful_windows == 0:
        raise SegmentTranslationFormatError(f"{item['item_id']}: all formula windows degraded to source")

    rebuilt_text = rebuild_formula_segment_translation(skeleton, translated_segments)
    result = {item["item_id"]: result_entry("translate", rebuilt_text)}
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    if request_label:
        print(
            f"{request_label}: windowed-formula rebuilt ok translated_windows={successful_windows}/{len(windows)}",
            flush=True,
        )
    return result
