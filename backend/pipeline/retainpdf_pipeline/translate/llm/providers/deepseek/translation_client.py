from __future__ import annotations
from retainpdf_pipeline.translate.llm.shared.executor_context import translation_unit

import json
import re

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.providers.deepseek.client import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.providers.deepseek.client import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.providers.deepseek.client import request_chat_content
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_messages
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_single_item_fallback_messages
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_group_member_messages
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.validation.errors import PartialBatchTranslationError
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.services.pipeline_shared.direct_typst_math import has_balanced_unescaped_dollars
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_json_text
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_single_item_translation_text
from retainpdf_pipeline.translate.llm.shared.response_parsing import unwrap_translation_shell
from retainpdf_pipeline.translate.llm.shared.structured_output import extract_string_fields
from retainpdf_pipeline.translate.llm.shared.structured_output import parse_structured_json
from retainpdf_pipeline.translate.llm.shared.structured_models import TRANSLATION_GROUP_MEMBER_RESPONSE_SCHEMA
from retainpdf_pipeline.translate.llm.shared.structured_models import TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA


TAGGED_ITEM_OPEN_RE = re.compile(
    r"<<<ITEM\s+item_id=(?P<item_id>[^\s>]+)(?:\s+decision=(?P<decision>[A-Za-z_-]+))?\s*>>>"
)
TAGGED_ITEM_END_RE = re.compile(r"<<<END>>>")
# 模型偶尔会在输出末尾损坏闭合标签(实测过 <<<END>>,少一个 >)。内容
# 完好只是标签残缺时不能丢条目,按残缺形态宽容剥离。
TAGGED_DAMAGED_END_RE = re.compile(r"\s*<{1,3}END>{0,4}\s*$")


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


def _compact_boundary_text(text: str) -> str:
    return re.sub(r"[\s，,、]+", "", str(text or ""))


def _group_member_payload_defect(
    item: dict,
    translated_text: str,
    member_translations: list[dict[str, str]],
) -> str:
    """检查群组 member 译文的协议完整性,返回缺陷描述(空串表示通过)。

    此前 member id 不做集合校验、逐 member 也不验证定界符:缺 id 会静默
    退化成几何切分(切错位置文字压错栏),公式跨 member 断开则整体奇偶
    校验照样通过、渲染各自坏。这里显式校验,让上层有机会重试。
    """
    expected_ids = [
        str(member_id or "").strip()
        for member_id in item.get("translation_unit_member_ids", [])
        if str(member_id or "").strip()
    ]
    if not expected_ids:
        return ""
    returned = {entry["item_id"]: entry["translated_text"] for entry in member_translations}
    if len(returned) != len(member_translations):
        return "duplicate member ids"
    missing = [mid for mid in expected_ids if not str(returned.get(mid, "") or "").strip()]
    extra = [mid for mid in returned if mid not in expected_ids]
    if missing or extra:
        return f"member ids mismatch: missing={missing} extra={extra}"
    aggregate = _compact_boundary_text(translated_text)
    concatenated = _compact_boundary_text("".join(returned[mid] for mid in expected_ids))
    if aggregate and concatenated != aggregate:
        return "member translations do not reconstruct aggregate translation"
    if str(item.get("math_mode", "") or "").strip() == "direct_typst":
        unbalanced = [mid for mid in expected_ids if not has_balanced_unescaped_dollars(returned[mid])]
        if unbalanced:
            return f"member math delimiters unbalanced: {unbalanced}"
    return ""


@translation_unit
def translate_continuation_group_members(
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
    messages = build_group_member_messages(
        item,
        domain_guidance=domain_guidance,
        mode=mode,
        target_language_name=target_language_name,
    )
    protocol_attempts = 2
    translated_text = ""
    member_translations: list[dict[str, str]] = []
    for attempt in range(1, protocol_attempts + 1):
        content = request_chat_content(
            messages,
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=TRANSLATION_GROUP_MEMBER_RESPONSE_SCHEMA,
            timeout=timeout_s,
            request_label=request_label,
            max_attempts=http_retry_attempts,
        )
        try:
            payload = parse_structured_json(content)
        except Exception as parse_exc:
            if attempt < protocol_attempts:
                if request_label:
                    print(f"{request_label}: group member json parse failed, retrying: {parse_exc}", flush=True)
                continue
            # 最后一轮:JSON 修复不了 LaTeX 转义损坏,抢救 translated_text
            # 字符串,整体译文仍可用(member 切分退化为几何切分)。
            salvaged = extract_string_fields(content, {"translated_text": ("translated_text",)}).get("translated_text", "")
            if not salvaged:
                raise
            if request_label:
                print(f"{request_label}: group member json unrecoverable, salvaged aggregate text only", flush=True)
            payload = {"translated_text": salvaged, "member_translations": []}
        translated_text = unwrap_translation_shell(str(payload.get("translated_text", "") or ""), item_id=item["item_id"])
        member_translations = [
            {
                "item_id": str(entry.get("item_id", "") or ""),
                "translated_text": str(entry.get("translated_text", "") or "").strip(),
            }
            for entry in payload.get("member_translations", [])
            if isinstance(entry, dict)
        ]
        defect = _group_member_payload_defect(item, translated_text, member_translations)
        if not defect:
            # Keep the persisted aggregate contract, without asking the model
            # to generate the same translation twice. Accept old responses too.
            by_id = {entry["item_id"]: entry["translated_text"] for entry in member_translations}
            member_ids = item.get("translation_unit_member_ids", [])
            if member_ids:
                member_translations = [
                    {"item_id": str(mid).strip(), "translated_text": by_id[str(mid).strip()]}
                    for mid in member_ids
                ]
                translated_text = translated_text or " ".join(entry["translated_text"] for entry in member_translations)
            break
        if attempt < protocol_attempts:
            if request_label:
                print(f"{request_label}: group member payload defect, retrying: {defect}", flush=True)
            continue
        # 重试后仍有缺陷:保留整体译文,丢弃不可信的 member 切分,显式
        # 交给几何切分兜底(此前是静默走到这一步,现在有日志有重试)。
        if request_label:
            print(f"{request_label}: group member payload defect persists, dropping member splits: {defect}", flush=True)
        if not translated_text:
            raise ValueError(f"Invalid continuation member translations: {defect}")
        member_translations = []
    result_payload = result_entry("translate", translated_text)
    result_payload["member_translations"] = member_translations
    result = {item["item_id"]: result_payload}
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
        raise PartialBatchTranslationError(accepted, retry_items)
    validate_batch_result(batch, result, diagnostics=diagnostics)
    return result
