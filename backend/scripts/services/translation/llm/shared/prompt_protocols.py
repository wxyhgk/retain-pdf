from __future__ import annotations

import json
import re
from typing import Any

from foundation.shared.prompt_loader import load_prompt
from foundation.shared.prompt_loader import render_prompt
from services.translation.context import TranslationItemContext


JSON_ONLY_INSTRUCTION = 'Return only valid JSON with the schema {"translations":[{"item_id":"...","translated_text":"..."}]}.'
LEGACY_JSON_ONLY_INSTRUCTION_ZH = (
    "返回结果时只输出符合以下结构的合法 JSON：\n"
    '{"translations":[{"item_id":"...","translated_text":"..."}]}'
)
DEFAULT_TARGET_LANGUAGE_NAME = "简体中文"
SOURCE_TERMINAL_RE = re.compile(r"[.!?。！？；;:：)\]）】”’\"']\s*$")


def _target_language_name(value: str = "") -> str:
    return (value or DEFAULT_TARGET_LANGUAGE_NAME).strip() or DEFAULT_TARGET_LANGUAGE_NAME


def _prompt_context(*, target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME) -> dict[str, str]:
    return {"target_language_name": _target_language_name(target_language_name)}


def _source_looks_incomplete(text: str) -> bool:
    source = str(text or "").strip()
    if not source:
        return False
    return SOURCE_TERMINAL_RE.search(source) is None


def _append_context_lines(lines: list[str], item: TranslationItemContext) -> None:
    context_before = item.context_before_for_prompt()
    if context_before:
        lines.append(f"前文上下文（仅供理解，禁止翻译进输出）：{context_before}")
    context_after = item.context_after_for_prompt()
    if context_after:
        if _source_looks_incomplete(item.source_for_prompt()):
            lines.append("当前原文是不完整片段；译文必须保持同等不完整，不要用后文上下文补全。")
        lines.append(f"后文上下文（仅供理解，禁止翻译进输出）：{context_after}")


def direct_math_guidance(*, target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME) -> str:
    return render_prompt("translation_direct_typst_guidance.txt", **_prompt_context(target_language_name=target_language_name))


def build_translation_system_prompt(
    *,
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
    include_sci_decision: bool = False,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    system_prompt = render_prompt(
        "translation_system_plain_text.txt"
        if response_style == "plain_text"
        else "translation_system.txt",
        **_prompt_context(target_language_name=target_language_name),
    )
    if response_style != "json":
        system_prompt = system_prompt.replace(JSON_ONLY_INSTRUCTION, "")
        system_prompt = system_prompt.replace(LEGACY_JSON_ONLY_INSTRUCTION_ZH, "").strip()
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    if mode == "sci" and include_sci_decision:
        system_prompt = f"{system_prompt}\n\n{load_prompt('translation_sci_decision.txt')}"
    return system_prompt


def direct_typst_batch_user_prompt(
    batch: list[TranslationItemContext],
    *,
    mode: str,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    lines: list[str] = [
        render_prompt("translation_task_plain_text.txt", **_prompt_context(target_language_name=target_language_name)),
        "",
        "下面是若干段待翻译正文。",
        "请为每段输出一个 tagged block，除此之外不要输出结构化数据、代码块、解释或额外文字。",
        "严格格式：",
        "<<<ITEM item_id=对应的原文 ID>>>",
        "译文",
        "<<<END>>>",
    ]
    for item in batch:
        lines.append("")
        lines.append(f"原文 {item.item_id}:")
        lines.append(item.source_for_prompt())
        if item.style_hint:
            lines.append(f"风格提示：{item.style_hint}")
        if item.continuation_group:
            lines.append("这是跨栏或跨页续接正文的一部分，请结合上下文理解后直接输出这一整段的译文。")
        _append_context_lines(lines, item)
    return "\n".join(lines).strip()


def direct_typst_single_user_prompt(
    item: TranslationItemContext,
    *,
    mode: str,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    lines: list[str] = [
        render_prompt("translation_task_plain_text.txt", **_prompt_context(target_language_name=target_language_name)),
        "",
        "下面是一段待翻译正文。",
        f"你只输出最终{_target_language_name(target_language_name)}译文正文，不要输出编号、决策字段、结构化数据、标签、代码块或解释。",
        "",
        "【当前原文开始】",
        item.source_for_prompt(),
        "【当前原文结束】",
    ]
    if item.style_hint:
        lines.append(f"风格提示：{item.style_hint}")
    if item.continuation_group:
        lines.append("这是跨栏或跨页续接正文的一部分，请结合上下文理解后直接输出这一整段的译文。")
    _append_context_lines(lines, item)
    return "\n".join(lines).strip()


def plain_text_single_user_prompt(
    item: TranslationItemContext,
    *,
    mode: str,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    lines: list[str] = [
        render_prompt("translation_task_plain_text.txt", **_prompt_context(target_language_name=target_language_name)),
        "",
        "下面是一段待翻译正文。",
        f"只输出这一段的最终{_target_language_name(target_language_name)}译文正文，不要输出编号、决策字段、结构化数据、标签、代码块或解释。",
        "",
        "【当前原文开始】",
        item.source_for_prompt(),
        "【当前原文结束】",
    ]
    if item.style_hint:
        lines.append(f"风格提示：{item.style_hint}")
    if item.continuation_group:
        lines.append("这是跨栏或跨页续接正文的一部分，请结合上下文理解后直接输出这一整段的译文。")
    _append_context_lines(lines, item)
    return "\n".join(lines).strip()


def batch_json_user_prompt(
    batch: list[TranslationItemContext],
    *,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    groups: dict[str, dict[str, Any]] = {}
    items_payload = []
    for item in batch:
        group_id = item.continuation_group
        item_payload = item.as_batch_payload()
        if group_id:
            group = groups.setdefault(group_id, {"group_id": group_id, "item_ids": [], "combined_source_text": []})
            group["item_ids"].append(item.item_id)
            group["combined_source_text"].append(item.source_for_context())
        items_payload.append(item_payload)
    user_payload = {
        "task": render_prompt("translation_task.txt", **_prompt_context(target_language_name=target_language_name)),
        "items": items_payload,
    }
    if groups:
        user_payload["continuation_groups"] = [
            {
                "group_id": group["group_id"],
                "item_ids": group["item_ids"],
                "combined_source_text": " ".join(group["combined_source_text"]),
            }
            for group in groups.values()
        ]
    return json.dumps(user_payload, ensure_ascii=False)


__all__ = [
    "batch_json_user_prompt",
    "build_translation_system_prompt",
    "direct_math_guidance",
    "direct_typst_batch_user_prompt",
    "direct_typst_single_user_prompt",
    "plain_text_single_user_prompt",
]
