"""全书风格指南 style-guide.v1.json。

两部分：
- baseline：出版规范里确定的通用体例（依据 CY/T 123—2015、CY/T 119—2015、
  GB/T 15834、GB 3100/3101 等），中文译入语时固定加入，不经模型。
- document：在领域识别（domain-context.json）和规则档（rule_profile）基础上，
  一次模型调用补充本书特有的规则。调用失败时只保留 baseline，不阻断翻译。

注入时用的文本由 render_style_guidance() 从冻结的产物确定性地渲染出来，
同一份产物永远得到同一段 system 前缀（缓存 key 因此稳定）。
"""
from __future__ import annotations

import hashlib
import json
from typing import Any
from typing import Callable

from retainpdf_pipeline.translate.llm.shared.executor_context import unit_scope
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.shared.structured_output import parse_structured_json
from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.preparation.term_base import now_iso

STYLE_GUIDE_FILE_NAME = "style-guide.v1.json"
STYLE_GUIDE_SCHEMA = "style_guide_v1"
STYLE_GUIDE_SCHEMA_VERSION = 1
STYLE_GUIDE_PROMPT_VERSION = "style-guide-v1"
STYLE_GUIDE_REQUEST_TIMEOUT_SECS = 90
STYLE_GUIDE_MAX_DOCUMENT_RULES = 12
STYLE_GUIDE_MAX_DO_NOT_TRANSLATE = 40
STYLE_GUIDE_SAMPLE_MAX_CHARS = 6000
STYLE_GUIDE_KEY_TERMS_LIMIT = 40

STYLE_GUIDE_REFERENCES = (
    "CY/T 123—2015 学术出版规范 中文译著",
    "CY/T 119—2015 学术出版规范 科学技术名词",
    "GB/T 19682—2005 翻译服务译文质量要求",
    "GB/T 15834—2011 标点符号用法",
    "GB 3100—1993 / GB 3101—1993 国际单位制及其应用 / 有关量、单位和符号的一般原则",
)

STYLE_GUIDE_CATEGORIES = frozenset(
    {"terminology", "cross_reference", "names", "numbers", "do_not_translate", "punctuation", "syntax", "other"}
)

# 中文译入语的通用体例。id 是稳定标识，QA 报告可以按它引用规则。
# apply="prompt" 的规则会渲染进 system 前缀；apply="qa" 的只留在产物里给 QA 检查用——
# 逐块翻译时模型看不到全书，判断不了「是不是首现」，把首现括注写进 prompt 只会让
# 每一块都加括注（重复括注正是 QA 要抓的问题）。
BASELINE_RULES_ZH: tuple[dict[str, str], ...] = (
    {
        "id": "first_mention_gloss",
        "category": "terminology",
        "rule": "专业术语在全书首次出现时采用「中文译名（英文全称，缩写）」的括注形式，之后统一只用中文译名或缩写，不再重复括注。",
        "example": "卷积神经网络（convolutional neural network，CNN）",
        "apply": "qa",
    },
    {
        "id": "term_consistency",
        "category": "terminology",
        "rule": "同一术语全书只用一种译法；给出的术语表译法优先于自行翻译。",
        "example": "",
        "apply": "prompt",
    },
    {
        "id": "cross_reference",
        "category": "cross_reference",
        "rule": "交叉引用按中文体例改写，编号保持原样：Figure 3.2 → 图 3.2，Table 1 → 表 1，Eq. (5) → 式(5)，Section 2.3 → 2.3 节，Chapter 4 → 第 4 章。",
        "example": "as shown in Figure 3.2 → 如图 3.2 所示",
        "apply": "prompt",
    },
    {
        "id": "foreign_name_interpunct",
        "category": "names",
        "rule": "外国人名采用通行译名，名与姓之间用间隔号「·」；无通行译名的人名保留原文。",
        "example": "John von Neumann → 约翰·冯·诺伊曼",
        "apply": "prompt",
    },
    {
        "id": "decades",
        "category": "numbers",
        "rule": "年代统一写成「20 世纪 60 年代」的形式，全书一致。",
        "example": "the 1960s → 20 世纪 60 年代",
        "apply": "prompt",
    },
    {
        "id": "numbers_units",
        "category": "numbers",
        "rule": "数值、单位、量符号和科学计数法照原文保留，不得改动数值；数字与单位之间按国标留空格。",
        "example": "",
        "apply": "prompt",
    },
    {
        "id": "do_not_translate",
        "category": "do_not_translate",
        "rule": "代码、变量名、函数名、命令、文件名、软件名、数据集名一律保留原文，不翻译。",
        "example": "",
        "apply": "prompt",
    },
    {
        "id": "references_verbatim",
        "category": "do_not_translate",
        "rule": "参考文献条目照录原文，不翻译。",
        "example": "",
        "apply": "prompt",
    },
    {
        "id": "translator_note",
        "category": "other",
        "rule": "不要擅自添加译者注；确需说明时，译者注放在括号内并以「——译者注」结尾。",
        "example": "（此处原文有误，应为式(5)。——译者注）",
        "apply": "prompt",
    },
    {
        "id": "punctuation",
        "category": "punctuation",
        "rule": "中文行文使用全角标点；省略号用「……」，破折号用「——」；数字和拉丁字母保持半角。",
        "example": "",
        "apply": "prompt",
    },
)

STYLE_GUIDE_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "style_guide_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "register": {"type": "string"},
                "audience": {"type": "string"},
                "rules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "category": {"type": "string"},
                            "rule": {"type": "string"},
                            "example": {"type": "string"},
                        },
                        "required": ["category", "rule", "example"],
                    },
                },
                "do_not_translate": {"type": "array", "items": {"type": "string"}},
                "notes": {"type": "string"},
            },
            "required": ["register", "audience", "rules", "do_not_translate", "notes"],
        },
    },
}

RequestFn = Callable[..., str]


def baseline_rules_for(target_lang: str) -> list[dict[str, str]]:
    if not str(target_lang or "").strip().lower().startswith("zh"):
        return []
    return [{**rule, "origin": "baseline"} for rule in BASELINE_RULES_ZH]


def build_style_guide_messages(
    *,
    target_language_name: str,
    domain_context: dict[str, Any],
    rule_profile_name: str,
    rule_guidance: str,
    key_terms: list[dict[str, str]],
    sample_text: str,
    baseline_rules: list[dict[str, str]],
) -> list[dict[str, str]]:
    system = load_prompt("style_guide_system.txt").replace("<<TARGET_LANGUAGE>>", target_language_name)
    user_payload = {
        "task": load_prompt("style_guide_task.txt"),
        "domain": {
            "domain": str(domain_context.get("domain", "") or "").strip(),
            "summary": str(domain_context.get("summary", "") or "").strip(),
            "translation_guidance": str(domain_context.get("translation_guidance", "") or "").strip(),
        },
        "rule_profile": {"name": rule_profile_name, "text": rule_guidance},
        "baseline_rules": [rule["rule"] for rule in baseline_rules],
        "key_terms": key_terms,
        "sample_text": sample_text[:STYLE_GUIDE_SAMPLE_MAX_CHARS],
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def style_guide_request_sha256(messages: list[dict[str, str]], *, model: str) -> str:
    canonical = json.dumps(
        {"prompt_version": STYLE_GUIDE_PROMPT_VERSION, "model": model, "messages": messages},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def parse_style_guide_response(content: str) -> dict[str, Any]:
    payload = parse_structured_json(content)
    if not isinstance(payload, dict):
        raise ValueError("style guide response must be a JSON object")
    rules = []
    for index, raw in enumerate(payload.get("rules") or []):
        if not isinstance(raw, dict):
            continue
        rule = " ".join(str(raw.get("rule", "") or "").split())
        if not rule:
            continue
        category = str(raw.get("category", "") or "").strip().lower()
        rules.append(
            {
                "id": f"document_{len(rules) + 1:02d}",
                "category": category if category in STYLE_GUIDE_CATEGORIES else "other",
                "rule": rule[:400],
                "example": " ".join(str(raw.get("example", "") or "").split())[:200],
                "origin": "document",
                "apply": "prompt",
            }
        )
        if len(rules) >= STYLE_GUIDE_MAX_DOCUMENT_RULES:
            break
    do_not_translate: list[str] = []
    for raw in payload.get("do_not_translate") or []:
        value = " ".join(str(raw or "").split())
        if value and value not in do_not_translate:
            do_not_translate.append(value[:80])
        if len(do_not_translate) >= STYLE_GUIDE_MAX_DO_NOT_TRANSLATE:
            break
    return {
        "register": " ".join(str(payload.get("register", "") or "").split())[:200],
        "audience": " ".join(str(payload.get("audience", "") or "").split())[:200],
        "rules": rules,
        "do_not_translate": do_not_translate,
        "notes": " ".join(str(payload.get("notes", "") or "").split())[:300],
    }


def request_document_style(
    messages: list[dict[str, str]],
    *,
    digest: str,
    api_key: str,
    model: str,
    base_url: str,
    request_fn: RequestFn | None = None,
) -> dict[str, Any]:
    request = request_fn or request_chat_content
    with unit_scope("style_guide", [digest]):
        content = request(
            messages,
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=STYLE_GUIDE_RESPONSE_SCHEMA,
            timeout=STYLE_GUIDE_REQUEST_TIMEOUT_SECS,
            request_label="style-guide",
            max_attempts=2,
        )
    return parse_style_guide_response(content)


def build_style_guide_payload(
    *,
    inputs_fingerprint: str,
    target_lang: str,
    target_language_name: str,
    domain_context: dict[str, Any],
    rule_profile_name: str,
    custom_rules_text: str,
    baseline_rules: list[dict[str, str]],
    document_style: dict[str, Any] | None,
    llm_status: str,
    model: str,
) -> dict[str, Any]:
    document = document_style or {}
    payload: dict[str, Any] = {
        "schema": STYLE_GUIDE_SCHEMA,
        "schema_version": STYLE_GUIDE_SCHEMA_VERSION,
        "generated_at": now_iso(),
        "inputs_fingerprint": inputs_fingerprint,
        # llm_status=failed 时只含 baseline，下次运行会重试补全。
        "complete": llm_status == "ok",
        "llm_status": llm_status,
        "model": model,
        "prompt_version": STYLE_GUIDE_PROMPT_VERSION,
        "target_lang": target_lang,
        "target_language_name": target_language_name,
        "references": list(STYLE_GUIDE_REFERENCES) if baseline_rules else [],
        "domain": {
            "domain": str(domain_context.get("domain", "") or "").strip(),
            "summary": str(domain_context.get("summary", "") or "").strip(),
        },
        "rule_profile": {"name": rule_profile_name, "custom_rules_text": custom_rules_text},
        "register": str(document.get("register", "") or ""),
        "audience": str(document.get("audience", "") or ""),
        "rules": [*baseline_rules, *list(document.get("rules") or [])],
        "do_not_translate": list(document.get("do_not_translate") or []),
        "notes": str(document.get("notes", "") or ""),
    }
    payload["prompt_text"] = render_style_guidance(payload)
    return payload


def render_style_guidance(payload: dict[str, Any] | None) -> str:
    """把冻结的风格指南渲染成 system 前缀里的一段文本（确定性）。"""
    if not payload:
        return ""
    rules = [
        rule
        for rule in payload.get("rules") or []
        if isinstance(rule, dict)
        and str(rule.get("rule", "")).strip()
        and str(rule.get("apply", "prompt") or "prompt") == "prompt"
    ]
    lines = ["Style guide (frozen for this book; follow it in every block):"]
    register = str(payload.get("register", "") or "").strip()
    audience = str(payload.get("audience", "") or "").strip()
    if register:
        lines.append(f"- 语体：{register}")
    if audience:
        lines.append(f"- 读者：{audience}")
    for rule in rules:
        text = str(rule.get("rule", "")).strip()
        example = str(rule.get("example", "") or "").strip()
        lines.append(f"- {text}" + (f" 例：{example}" if example else ""))
    do_not_translate = [str(value).strip() for value in payload.get("do_not_translate") or [] if str(value).strip()]
    if do_not_translate:
        lines.append("- 本书保留原文不译：" + "、".join(do_not_translate))
    if len(lines) == 1:
        return ""
    return "\n".join(lines)


__all__ = [
    "BASELINE_RULES_ZH",
    "STYLE_GUIDE_FILE_NAME",
    "STYLE_GUIDE_SCHEMA",
    "STYLE_GUIDE_SCHEMA_VERSION",
    "baseline_rules_for",
    "build_style_guide_messages",
    "build_style_guide_payload",
    "parse_style_guide_response",
    "render_style_guidance",
    "request_document_style",
    "style_guide_request_sha256",
]
