from __future__ import annotations
from retainpdf_translation.llm.shared.executor_context import translation_unit

import json
import re

from retainpdf_translation.artifacts import TranslationDiagnosticsCollector
from retainpdf_translation.llm.providers.deepseek.client import DEFAULT_BASE_URL
from retainpdf_translation.llm.providers.deepseek.client import DEFAULT_MODEL
from retainpdf_translation.llm.providers.deepseek.client import request_chat_content
from retainpdf_translation_classic.llm.shared.prompt_building import build_messages
from retainpdf_translation_classic.llm.shared.prompt_building import build_single_item_fallback_messages
from retainpdf_translation_classic.llm.result_validator import validate_batch_result
from retainpdf_translation.llm.validation.errors import PartialBatchTranslationError
from retainpdf_translation.llm.shared.output_limits import ModelOutputIncomplete
from retainpdf_translation.llm.shared.output_limits import TRUNCATED
from retainpdf_translation_classic.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_translation.llm.result_payload import result_entry
from retainpdf_translation.llm.shared.response_parsing import extract_json_text
from retainpdf_translation.llm.shared.response_parsing import extract_single_item_translation_text
from retainpdf_translation.llm.shared.response_parsing import unwrap_translation_shell
from retainpdf_translation.llm.shared.structured_output import parse_structured_json
from retainpdf_translation.llm.shared.structured_models import TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA


TAGGED_ITEM_OPEN_RE = re.compile(
    r"<<<ITEM\s+item_id=(?P<item_id>[^\s>]+)(?:\s+decision=(?P<decision>[A-Za-z_-]+))?\s*>>>"
)
TAGGED_ITEM_END_RE = re.compile(r"<<<END>>>")
# 模型偶尔会在输出末尾损坏闭合标签(实测过 <<<END>>,少一个 >)。内容
# 完好只是标签残缺时不能丢条目,按残缺形态宽容剥离。
TAGGED_DAMAGED_END_RE = re.compile(r"\s*<{1,3}END>{0,4}\s*$")


def closed_tagged_prefix(content: str) -> str:
    """截断的批量回答里到最后一个完整 ``<<<END>>>`` 为止的部分（后面写了一半的块不要）；一个完整的都没有交回空串。"""
    text = content or ""
    ends = list(TAGGED_ITEM_END_RE.finditer(text))
    if not ends or not TAGGED_ITEM_OPEN_RE.search(text):
        return ""
    return text[: ends[-1].end()]


def parse_translation_payload(content: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    seen: set[str] = set()
    def add(item_id, decision, translated_text):
        if item_id in seen:
            result.pop(item_id, None)
        else:
            seen.add(item_id)
            result[item_id] = result_entry(decision, translated_text)
    text = content or ""
    opens = list(TAGGED_ITEM_OPEN_RE.finditer(text))
    for index, match in enumerate(opens):
        item_id = (match.group("item_id") or "").strip()
        if not item_id:
            continue
        decision = match.group("decision") or "translate"
        segment_end = opens[index + 1].start() if index + 1 < len(opens) else len(text)
        segment = text[match.end() : segment_end]
        closed = TAGGED_ITEM_END_RE.search(segment)
        if closed:
            translated_text = segment[: closed.start()].strip()
        else:
            # 缺失/残缺闭合:下一个开标签或字符串结尾即隐式闭合
            translated_text = TAGGED_DAMAGED_END_RE.sub("", segment).strip()
        add(item_id, decision, translated_text)
    if opens:
        return result

    payload = parse_structured_json(content)
    translations = payload.get("translations", [])
    for item in translations:
        item_id = item.get("item_id")
        translated_text = unwrap_translation_shell(str(item.get("translated_text", "") or ""), item_id=str(item_id or ""))
        decision = item.get("decision", "translate")
        if item_id:
            add(item_id, decision, translated_text)
    return result


@translation_unit
def translate_single_item_plain_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    target_language_name: str = "简体中文",
    diagnostics: TranslationDiagnosticsCollector | None = None,
    timeout_s: int = 120,
    http_retry_attempts: int | None = None,
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_single_item_fallback_messages(
            item,
            domain_guidance=domain_guidance,
            mode=mode,
            structured_decision=False,
            response_style="plain_text",
            target_language_name=target_language_name,
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=timeout_s,
        request_label=request_label,
        max_attempts=http_retry_attempts,
    )
    translated_text = extract_single_item_translation_text(content, item["item_id"])
    result = {item["item_id"]: result_entry("translate", translated_text)}
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    return result


@translation_unit
def translate_single_item_plain_text_unstructured(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    target_language_name: str = "简体中文",
    diagnostics: TranslationDiagnosticsCollector | None = None,
    timeout_s: int = 120,
    http_retry_attempts: int | None = None,
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_single_item_fallback_messages(
            item,
            domain_guidance=domain_guidance,
            mode=mode,
            structured_decision=False,
            response_style="plain_text",
            target_language_name=target_language_name,
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=timeout_s,
        request_label=request_label,
        max_attempts=http_retry_attempts,
    )
    translated_text = extract_single_item_translation_text(content, item["item_id"])
    result = {item["item_id"]: result_entry("translate", translated_text)}
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    return result


@translation_unit
def translate_single_item_tagged_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    target_language_name: str = "简体中文",
    diagnostics: TranslationDiagnosticsCollector | None = None,
    timeout_s: int = 120,
    http_retry_attempts: int | None = None,
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_messages(
            [item],
            domain_guidance=domain_guidance,
            mode="fast",
            response_style="tagged",
            target_language_name=target_language_name,
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=timeout_s,
        request_label=request_label,
        max_attempts=http_retry_attempts,
    )
    result = parse_translation_payload(content)
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    return result


@translation_unit
def translate_single_item_with_decision(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    target_language_name: str = "简体中文",
    diagnostics: TranslationDiagnosticsCollector | None = None,
    timeout_s: int = 120,
    http_retry_attempts: int | None = None,
) -> dict[str, dict[str, str]]:
    content = request_chat_content(
        build_single_item_fallback_messages(
            item,
            domain_guidance=domain_guidance,
            mode=mode,
            structured_decision=True,
            response_style="json",
            target_language_name=target_language_name,
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA,
        timeout=timeout_s,
        request_label=request_label,
        max_attempts=http_retry_attempts,
    )
    try:
        payload = json.loads(extract_json_text(content))
        result = {
            item["item_id"]: result_entry(
                str(payload.get("decision", "translate") or "translate"),
                unwrap_translation_shell(str(payload.get("translated_text", "") or ""), item_id=item["item_id"]),
            )
        }
    except Exception:
        result = parse_translation_payload(content)
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    return result


@translation_unit
def translate_batch_once(
    batch: list[dict],
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    target_language_name: str = "简体中文",
    diagnostics: TranslationDiagnosticsCollector | None = None,
    timeout_s: int = 120,
    http_retry_attempts: int | None = None,
) -> dict[str, dict[str, str]]:
    truncated: ModelOutputIncomplete | None = None
    try:
        content = request_chat_content(
            build_messages(
                batch,
                domain_guidance=domain_guidance,
                mode=mode,
                response_style="tagged",
                target_language_name=target_language_name,
            ),
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.2,
            response_format=None,
            timeout=timeout_s,
            request_label=request_label,
            max_attempts=http_retry_attempts,
        )
    except ModelOutputIncomplete as exc:
        # 回答写到上限被截断：已经用 <<<END>>> 写完的块照收，写了一半的和没写到的拆成单块重翻
        content = closed_tagged_prefix(exc.partial_content) if exc.kind == TRUNCATED else ""
        if not content:
            raise
        truncated = exc
        if request_label:
            print(f"{request_label}: batch output truncated, keep fully closed items and retry the rest: {exc}", flush=True)
    result = parse_translation_payload(content)
    result = canonicalize_batch_result(batch, result)
    # Retain only independently validated expected members. Unexpected IDs
    # remain a whole-response protocol error, never silently accepted.
    if set(result) - {item["item_id"] for item in batch}:
        validate_batch_result(batch, result, diagnostics=diagnostics)
    accepted, retry_items = {}, []
    for item in batch:
        item_id = item["item_id"]
        member_result = {item_id: result[item_id]} if item_id in result else {}
        try:
            validate_batch_result([item], member_result, diagnostics=diagnostics)
        except (ValueError, KeyError):
            retry_items.append(item)
        else:
            accepted.update(member_result)
    if retry_items:
        if truncated is not None and not accepted:
            raise truncated
        raise PartialBatchTranslationError(accepted, retry_items)
    validate_batch_result(batch, result, diagnostics=diagnostics)
    return result
