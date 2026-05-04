from __future__ import annotations

import json
from typing import Any

from foundation.shared.prompt_loader import load_prompt
from services.translation.context import TranslationItemContext
from services.translation.context import build_item_context


_JSON_ONLY_INSTRUCTION = 'Return only valid JSON with the schema {"translations":[{"item_id":"...","translated_text":"..."}]}.'
_LEGACY_JSON_ONLY_INSTRUCTION_ZH = (
    "返回结果时只输出符合以下结构的合法 JSON：\n"
    '{"translations":[{"item_id":"...","translated_text":"..."}]}'
)


def _item_context(item: dict | TranslationItemContext) -> TranslationItemContext:
    if isinstance(item, TranslationItemContext):
        return item
    return build_item_context(item)


def _item_math_mode(item: dict | TranslationItemContext) -> str:
    return _item_context(item).math_mode


def _direct_math_guidance() -> str:
    return (
        "当前启用 direct_typst 公式直出模式。\n"
        "请先理解整句语义，再直接输出中文译文。\n"
        "凡是语义上属于公式、变量、上下标、数学表达式、化学式、物理量符号、带上标或下标的单位与记号，请主动用 `$...$` 包裹。\n"
        "不要把裸露的 LaTeX 风格数学片段直接留在正文里。\n"
        "普通正文不要随意放进 `$...$`。\n"
        "如果 OCR 造成公式存在明显且局部的错误，例如空格错乱、括号缺失、花括号缺失、上下标脱落或命令被截断，你可以按语义做最小修复后再输出，使其可以正常渲染。\n"
        "不要补写缺失的正文内容，不要扩写原文，不要编造新的科学信息。\n"
        "不要输出占位符、结构化数据、标签、代码块或解释，只输出最终译文。"
    )


def _direct_typst_batch_user_prompt(
    batch: list[TranslationItemContext],
    *,
    mode: str,
) -> str:
    lines: list[str] = [
        load_prompt("translation_task_plain_text.txt"),
        "",
        "下面是若干段待翻译正文。",
        "你只输出每段的最终中文译文，不要回写编号、决策字段、结构化数据或标签。",
    ]
    for item in batch:
        lines.append("")
        lines.append(f"原文 {item.item_id}:")
        lines.append(item.source_for_prompt())
        if item.style_hint:
            lines.append(f"风格提示：{item.style_hint}")
        if item.continuation_group:
            lines.append("这是跨栏或跨页续接正文的一部分，请结合上下文理解后直接输出这一整段的译文。")
        context_before = item.context_before_for_prompt()
        if context_before:
            lines.append(f"前文上下文：{context_before}")
        context_after = item.context_after_for_prompt()
        if context_after:
            lines.append(f"后文上下文：{context_after}")
    return "\n".join(lines).strip()


def _direct_typst_single_user_prompt(
    item: TranslationItemContext,
    *,
    mode: str,
) -> str:
    lines: list[str] = [
        load_prompt("translation_task_plain_text.txt"),
        "",
        "下面是一段待翻译正文。",
        "你只输出最终中文译文正文，不要输出编号、决策字段、结构化数据、标签、代码块或解释。",
        "",
        "原文：",
        item.source_for_prompt(),
    ]
    if item.style_hint:
        lines.append(f"风格提示：{item.style_hint}")
    if item.continuation_group:
        lines.append("这是跨栏或跨页续接正文的一部分，请结合上下文理解后直接输出这一整段的译文。")
    context_before = item.context_before_for_prompt()
    if context_before:
        lines.append(f"前文上下文：{context_before}")
    context_after = item.context_after_for_prompt()
    if context_after:
        lines.append(f"后文上下文：{context_after}")
    return "\n".join(lines).strip()


def _plain_text_single_user_prompt(
    item: TranslationItemContext,
    *,
    mode: str,
) -> str:
    lines: list[str] = [
        load_prompt("translation_task_plain_text.txt"),
        "",
        "下面是一段待翻译正文。",
        "只输出这一段的最终中文译文正文，不要输出编号、决策字段、结构化数据、标签、代码块或解释。",
        "",
        "原文：",
        item.source_for_prompt(),
    ]
    if item.style_hint:
        lines.append(f"风格提示：{item.style_hint}")
    if item.continuation_group:
        lines.append("这是跨栏或跨页续接正文的一部分，请结合上下文理解后直接输出这一整段的译文。")
    context_before = item.context_before_for_prompt()
    if context_before:
        lines.append(f"前文上下文：{context_before}")
    context_after = item.context_after_for_prompt()
    if context_after:
        lines.append(f"后文上下文：{context_after}")
    return "\n".join(lines).strip()


def _build_translation_system_prompt(
    *,
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
    include_sci_decision: bool = False,
) -> str:
    system_prompt = load_prompt("translation_system.txt")
    if response_style != "json":
        system_prompt = system_prompt.replace(_JSON_ONLY_INSTRUCTION, "")
        system_prompt = system_prompt.replace(_LEGACY_JSON_ONLY_INSTRUCTION_ZH, "").strip()
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    if mode == "sci" and include_sci_decision:
        system_prompt = f"{system_prompt}\n\n{load_prompt('translation_sci_decision.txt')}"
    return system_prompt


def build_messages(
    batch: list[dict],
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
) -> list[dict[str, str]]:
    item_contexts = [_item_context(item) for item in batch]
    direct_typst_mode = any(item.math_mode == "direct_typst" for item in item_contexts)
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style=response_style,
    )
    if response_style == "json":
        system_prompt = (
            f"{system_prompt}\n\n"
            f"{load_prompt('translation_output_json.txt')}"
        )
    else:
        system_prompt = (
            f"{system_prompt}\n\n"
            f"{load_prompt('translation_output_tagged.txt').format(tagged_header='<<<ITEM item_id=ITEM_ID>>>')}"
        )
    if direct_typst_mode:
        system_prompt = f"{system_prompt}\n\n{_direct_math_guidance()}"
    groups: dict[str, dict[str, Any]] = {}
    items_payload = []
    for item in item_contexts:
        group_id = item.continuation_group
        item_payload = item.as_batch_payload()
        if group_id:
            group = groups.setdefault(group_id, {"group_id": group_id, "item_ids": [], "combined_source_text": []})
            group["item_ids"].append(item.item_id)
            group["combined_source_text"].append(item.source_for_context())
        items_payload.append(item_payload)
    user_payload = {
        "task": load_prompt("translation_task.txt"),
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
    user_content = (
        _direct_typst_batch_user_prompt(item_contexts, mode=mode)
        if direct_typst_mode
        else json.dumps(user_payload, ensure_ascii=False)
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def build_single_item_fallback_messages(
    item: dict,
    domain_guidance: str = "",
    mode: str = "fast",
    structured_decision: bool = False,
    response_style: str = "plain_text",
) -> list[dict[str, str]]:
    item_context = _item_context(item)
    direct_typst_mode = item_context.math_mode == "direct_typst"
    if mode == "sci" and structured_decision:
        system_prompt = _build_translation_system_prompt(
            domain_guidance=domain_guidance,
            mode=mode,
            response_style="json" if response_style == "json" else "tagged",
            include_sci_decision=True,
        )
        if response_style == "json":
            system_prompt = (
                f"{system_prompt}\n\n"
                'Return only JSON matching {"decision":"translate","translated_text":"translated text"}. '
                "Do not include markdown, code fences, or explanations."
            )
        user_prompt = (
            _direct_typst_single_user_prompt(item_context, mode=mode)
            if direct_typst_mode
            else json.dumps(
                {
                    "task": load_prompt("translation_task.txt"),
                    "items": [
                        {
                            "item_id": item_context.item_id,
                            "source_text": item_context.source_for_prompt(),
                            **(
                                {"style_hint": item_context.style_hint}
                                if item_context.style_hint
                                else {}
                            ),
                        }
                    ],
                },
                ensure_ascii=False,
            )
        )
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style="json" if response_style == "json" else "plain_text",
        include_sci_decision=False,
    )
    if response_style == "json":
        fallback_system = (
            f"{system_prompt}\n"
            f"{load_prompt('translation_output_single_json.txt')}"
        )
    else:
        fallback_system = (
            f"{system_prompt}\n"
            f"{load_prompt('translation_output_plain_text.txt')}"
        )
    if direct_typst_mode:
        fallback_system = f"{fallback_system}\n{_direct_math_guidance()}"
    user_prompt = (
        _direct_typst_single_user_prompt(item_context, mode=mode)
        if direct_typst_mode
        else (
            json.dumps(
                {
                    "task": load_prompt("translation_task.txt"),
                    "item": {
                        "item_id": item_context.item_id,
                        "source_text": item_context.source_for_prompt(),
                    },
                },
                ensure_ascii=False,
            )
            if response_style == "json"
            else _plain_text_single_user_prompt(item_context, mode=mode)
        )
    )
    return [
        {"role": "system", "content": fallback_system},
        {"role": "user", "content": user_prompt},
    ]
