from __future__ import annotations

from retainpdf_pipeline.translate.core.context import TranslationItemContext
from retainpdf_pipeline.translate.core.context import build_item_context
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import batch_json_user_prompt
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import direct_typst_batch_user_prompt as _direct_typst_batch_user_prompt
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import group_member_json_user_prompt as _group_member_json_user_prompt
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import protocol_system_prompt
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import single_user_prompt


def _item_context(item: dict | TranslationItemContext) -> TranslationItemContext:
    if isinstance(item, TranslationItemContext):
        return item
    return build_item_context(item)


def _item_math_mode(item: dict | TranslationItemContext) -> str:
    return _item_context(item).math_mode


def _messages(system: str, user: str) -> list[dict[str, str]]:
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_messages(
    batch: list[dict],
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
    target_language_name: str = "简体中文",
) -> list[dict[str, str]]:
    item_contexts = [_item_context(item) for item in batch]
    direct_typst_mode = any(item.math_mode == "direct_typst" for item in item_contexts)
    system_prompt = protocol_system_prompt(
        "batch",
        domain_guidance=domain_guidance,
        mode=mode,
        response_style=response_style,
        target_language_name=target_language_name,
        direct_typst=direct_typst_mode,
    )
    user_content = (
        _direct_typst_batch_user_prompt(item_contexts, mode=mode, target_language_name=target_language_name, response_style=response_style)
        if direct_typst_mode
        else batch_json_user_prompt(item_contexts, target_language_name=target_language_name)
    )
    return _messages(system_prompt, user_content)


def build_single_item_fallback_messages(
    item: dict,
    domain_guidance: str = "",
    mode: str = "fast",
    structured_decision: bool = False,
    response_style: str = "plain_text",
    target_language_name: str = "简体中文",
) -> list[dict[str, str]]:
    item_context = _item_context(item)
    system_prompt = protocol_system_prompt(
        "single",
        domain_guidance=domain_guidance,
        mode=mode,
        response_style=response_style,
        target_language_name=target_language_name,
        direct_typst=item_context.math_mode == "direct_typst",
        structured_decision=structured_decision,
    )
    user_prompt = single_user_prompt(
        item_context,
        mode=mode,
        response_style=response_style,
        target_language_name=target_language_name,
        structured_decision=structured_decision,
    )
    return _messages(system_prompt, user_prompt)


def build_group_member_messages(
    item: dict,
    domain_guidance: str = "",
    mode: str = "fast",
    target_language_name: str = "简体中文",
) -> list[dict[str, str]]:
    item_context = _item_context(item)
    system_prompt = protocol_system_prompt(
        "group",
        domain_guidance=domain_guidance,
        mode=mode,
        response_style="json",
        target_language_name=target_language_name,
        direct_typst=_item_math_mode(item_context) == "direct_typst",
    )
    return _messages(
        system_prompt,
        _group_member_json_user_prompt(item_context, target_language_name=target_language_name),
    )
