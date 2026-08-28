from __future__ import annotations

import json
import re

from services.translation.artifacts import TranslationDiagnosticsCollector
from services.translation.llm.providers.deepseek.client import DEFAULT_BASE_URL
from services.translation.llm.providers.deepseek.client import DEFAULT_MODEL
from services.translation.llm.providers.deepseek.client import request_chat_content
from services.translation.llm.shared.prompt_building import build_messages
from services.translation.llm.shared.prompt_building import build_single_item_fallback_messages
from services.translation.llm.shared.prompt_building import build_group_member_messages
from services.translation.llm.result_validator import validate_batch_result
from services.translation.llm.result_canonicalizer import canonicalize_batch_result
from services.translation.llm.result_payload import result_entry
from services.pipeline_shared.direct_typst_math import has_balanced_unescaped_dollars
from services.translation.llm.shared.response_parsing import extract_json_text
from services.translation.llm.shared.response_parsing import extract_single_item_translation_text
from services.translation.llm.shared.response_parsing import unwrap_translation_shell
from services.translation.llm.shared.structured_output import extract_string_fields
from services.translation.llm.shared.structured_output import parse_structured_json
from services.translation.llm.shared.structured_models import TRANSLATION_GROUP_MEMBER_RESPONSE_SCHEMA
from services.translation.llm.shared.structured_models import TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA


TAGGED_ITEM_OPEN_RE = re.compile(
    r"<<<ITEM\s+item_id=(?P<item_id>[^\s>]+)(?:\s+decision=(?P<decision>[A-Za-z_-]+))?\s*>>>"
)
TAGGED_ITEM_END_RE = re.compile(r"<<<END>>>")
# Mô hình đôi khi phá vỡ nhãn đóng ở cuối đầu ra(Đã đo <<<END>>,Ít hơn một >)。NỘI DUNG
# Chính xác. Bạn không thể bỏ một mục nhập nếu thẻ bị thiếu.,Gọt vỏ dung sai theo hình dạng của sự biến dạng。
TAGGED_DAMAGED_END_RE = re.compile(r"\s*<{1,3}END>{0,4}\s*$")


def parse_translation_payload(content: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
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
            # thiếu sót/Đóng tình trạng khuyết tật:Đóng tiềm ẩn ở cuối nhãn hoặc chuỗi mở tiếp theo
            translated_text = TAGGED_DAMAGED_END_RE.sub("", segment).strip()
        result[item_id] = result_entry(decision, translated_text)
    if result:
        return result

    payload = parse_structured_json(content)
    translations = payload.get("translations", [])
    for item in translations:
        item_id = item.get("item_id")
        translated_text = unwrap_translation_shell(str(item.get("translated_text", "") or ""), item_id=str(item_id or ""))
        decision = item.get("decision", "translate")
        if item_id:
            result[item_id] = result_entry(decision, translated_text)
    return result


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


def _group_member_payload_defect(item: dict, member_translations: list[dict[str, str]]) -> str:
    """Kiểm tra nhóm member Tính toàn vẹn của thỏa thuận dịch thuật,Quay lại mô tả lỗi(Chuỗi trống cho biết đã vượt qua)。

    trước đây member id Không xác thực bộ sưu tập、đuổi member Cũng không xác nhận các dấu phân cách:khuyết id Sẽ im lặng
    suy biến thành phân đoạn hình học(Văn bản vị trí sai tiếp tuyến được nhấn sai cột),Nhịp phương trình member Ngắt kết nối và toàn bộ tính chẵn lẻ
    Đã vượt qua xác minh、Kết xuất từng lỗi。Xác nhận rõ ràng tại đây,Cho lớp trên một cơ hội để thử lại。
    """
    expected_ids = [
        str(member_id or "").strip()
        for member_id in item.get("translation_unit_member_ids", [])
        if str(member_id or "").strip()
    ]
    if not expected_ids:
        return ""
    returned = {entry["item_id"]: entry["translated_text"] for entry in member_translations}
    missing = [mid for mid in expected_ids if not str(returned.get(mid, "") or "").strip()]
    extra = [mid for mid in returned if mid not in expected_ids]
    if missing or extra:
        return f"member ids mismatch: missing={missing} extra={extra}"
    if str(item.get("math_mode", "") or "").strip() == "direct_typst":
        unbalanced = [mid for mid in expected_ids if not has_balanced_unescaped_dollars(returned[mid])]
        if unbalanced:
            return f"member math delimiters unbalanced: {unbalanced}"
    return ""


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
            # Vòng chung kết:JSON Không thể sửa chữa LaTeX Thoát khỏi sát thương,cấp cứu translated_text
            # Chuỗi,Bản dịch tổng thể vẫn có sẵn(member Phân đoạn thoái hóa thành phân đoạn hình học)。
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
        defect = _group_member_payload_defect(item, member_translations)
        if not defect:
            break
        if attempt < protocol_attempts:
            if request_label:
                print(f"{request_label}: group member payload defect, retrying: {defect}", flush=True)
            continue
        # Vẫn bị lỗi sau khi thử lại:Giữ lại toàn bộ bản dịch,Loại bỏ những thông tin không đáng tin cậy member Split,Rõ ràng
        # Bàn giao hình học để tách mặt sau của túi(Trước đây, thật im lặng khi đi xa đến thế này.,Hiện đã có nhật ký với các lần thử lại)。
        if request_label:
            print(f"{request_label}: group member payload defect persists, dropping member splits: {defect}", flush=True)
        member_translations = []
    result_payload = result_entry("translate", translated_text)
    result_payload["member_translations"] = member_translations
    result = {item["item_id"]: result_payload}
    result = canonicalize_batch_result([item], result)
    validate_batch_result([item], result, diagnostics=diagnostics)
    return result


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
    validate_batch_result(batch, result, diagnostics=diagnostics)
    return result
