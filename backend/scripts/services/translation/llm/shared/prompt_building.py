from __future__ import annotations

import json

from foundation.shared.prompt_loader import load_prompt
from foundation.shared.prompt_loader import render_prompt
from services.translation.core.context import TranslationItemContext
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import batch_json_user_prompt
from services.translation.llm.shared.prompt_protocols import build_translation_system_prompt as _build_translation_system_prompt
from services.translation.llm.shared.prompt_protocols import direct_math_guidance as _direct_math_guidance
from services.translation.llm.shared.prompt_protocols import direct_typst_batch_user_prompt as _direct_typst_batch_user_prompt
from services.translation.llm.shared.prompt_protocols import direct_typst_single_user_prompt as _direct_typst_single_user_prompt
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt as _group_member_json_user_prompt
from services.translation.llm.shared.prompt_protocols import plain_text_single_user_prompt as _plain_text_single_user_prompt


def _item_context(item: dict | TranslationItemContext) -> TranslationItemContext:
    if isinstance(item, TranslationItemContext):
        return item
    return build_item_context(item)


def _item_math_mode(item: dict | TranslationItemContext) -> str:
    return _item_context(item).math_mode


def build_messages(
    batch: list[dict],
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
    target_language_name: str = "Simplified Chinese",
) -> list[dict[str, str]]:
    item_contexts = [_item_context(item) for item in batch]
    direct_typst_mode = any(item.math_mode == "direct_typst" for item in item_contexts)
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style=response_style,
        target_language_name=target_language_name,
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
        system_prompt = f"{system_prompt}\n\n{_direct_math_guidance(target_language_name=target_language_name)}"
    user_content = (
        _direct_typst_batch_user_prompt(item_contexts, mode=mode, target_language_name=target_language_name)
        if direct_typst_mode
        else batch_json_user_prompt(item_contexts, target_language_name=target_language_name)
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
    target_language_name: str = "Simplified Chinese",
) -> list[dict[str, str]]:
    item_context = _item_context(item)
    direct_typst_mode = item_context.math_mode == "direct_typst"
    if mode == "sci" and structured_decision:
        system_prompt = _build_translation_system_prompt(
            domain_guidance=domain_guidance,
            mode=mode,
            response_style="json" if response_style == "json" else "tagged",
            include_sci_decision=True,
            target_language_name=target_language_name,
        )
        if response_style == "json":
            system_prompt = (
                f"{system_prompt}\n\n"
                'Return only JSON matching {"decision":"translate","translated_text":"translated text"}.'
                "Do not include Markdown, code fences, or explanations."
            )
        user_prompt = (
            _direct_typst_single_user_prompt(item_context, mode=mode, target_language_name=target_language_name)
            if direct_typst_mode
            else json.dumps(
                {
                    "task": render_prompt("translation_task.txt", target_language_name=target_language_name),
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
        target_language_name=target_language_name,
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
        fallback_system = f"{fallback_system}\n{_direct_math_guidance(target_language_name=target_language_name)}"
    user_prompt = (
        _direct_typst_single_user_prompt(item_context, mode=mode, target_language_name=target_language_name)
        if direct_typst_mode
        else (
            json.dumps(
                {
                    "task": render_prompt("translation_task.txt", target_language_name=target_language_name),
                    "item": {
                        "item_id": item_context.item_id,
                        "source_text": item_context.source_for_prompt(),
                    },
                },
                ensure_ascii=False,
            )
            if response_style == "json"
            else _plain_text_single_user_prompt(item_context, mode=mode, target_language_name=target_language_name)
        )
    )
    return [
        {"role": "system", "content": fallback_system},
        {"role": "user", "content": user_prompt},
    ]


def build_group_member_messages(
    item: dict,
    domain_guidance: str = "",
    mode: str = "fast",
    target_language_name: str = "Simplified Chinese",
) -> list[dict[str, str]]:
    item_context = _item_context(item)
    system_prompt = _build_translation_system_prompt(
        domain_guidance=domain_guidance,
        mode=mode,
        response_style="json",
        include_sci_decision=False,
        target_language_name=target_language_name,
    )
    system_prompt = (
        f"{system_prompt}\n\n"
        "Return only valid JSON. Required schema: "
        '{"translated_text":"full translated continuation group","member_translations":[{"item_id":"...","translated_text":"..."}]}. '
        "Every member_id from the request must appear exactly once."
    )
    if _item_math_mode(item_context) == "direct_typst":
        system_prompt = f"{system_prompt}\n{_direct_math_guidance(target_language_name=target_language_name)}"
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": _group_member_json_user_prompt(item_context, target_language_name=target_language_name)},
    ]
