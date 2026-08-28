from __future__ import annotations

import json
import re
from typing import Any

from foundation.shared.prompt_loader import load_prompt
from foundation.shared.prompt_loader import render_prompt
from services.pipeline_shared.direct_typst_math import find_mitex_rewrites
from services.pipeline_shared.direct_typst_math import has_balanced_unescaped_dollars
from services.translation.core.context import TranslationItemContext


JSON_ONLY_INSTRUCTION = 'Return only valid JSON with the schema {"translations":[{"item_id":"...","translated_text":"..."}]}.'
# Legacy Chinese prompt string: kept to maintain compatibility and remove
# old version prompt templates.
LEGACY_JSON_ONLY_INSTRUCTION_ZH = (
    "Return only valid JSON with the following schema:\n"
    '{"translations":[{"item_id":"...","translated_text":"..."}]}'
)
DEFAULT_TARGET_LANGUAGE_NAME = "Simplified Chinese"
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
        lines.append(f"Preceding context (for understanding only, must not be translated into the output): {context_before}")
    context_after = item.context_after_for_prompt()
    if context_after:
        if _source_looks_incomplete(item.source_for_prompt()):
            lines.append(
                "The current source text is an incomplete fragment; the translation must stay equally "
                "incomplete and must not be completed using the following context."
            )
        lines.append(f"Following context (for understanding only, must not be translated into the output): {context_after}")


MATH_DELIMITER_DAMAGE_HINT = (
    "Note: the number of math delimiters `$` in this source text is odd, which means OCR lost a matching `$`. "
    "Determine the real boundaries of the formulas from the semantics and repair them in the translation, "
    "making sure every formula is closed as a `$...$` pair."
)


def _append_math_delimiter_damage_hint(lines: list[str], item: TranslationItemContext) -> None:
    # When $ in the source text is unbalanced, the model will certainly generate an unbalanced
    # translation, triggering the entire check/repair chain (measured: one item costs ~10 LLM calls).
    # Therefore, prompt the model to fix it semantically first.
    if not has_balanced_unescaped_dollars(item.source_for_prompt()):
        lines.append(MATH_DELIMITER_DAMAGE_HINT)
    _append_mitex_rewrite_hint(lines, item)


def _append_mitex_rewrite_hint(lines: list[str], item: TranslationItemContext) -> None:
    # On-demand hinting: only when the source text actually contains commands that
    # the renderer does not support, notify the model of replacement rules so it can replace
    # them at the semantic level (for complex formulas, regex rewriting is unreliable);
    # regex rewriting during rendering is still kept as a fallback.
    rewrites = find_mitex_rewrites(item.source_for_prompt())
    if not rewrites:
        return
    pairs = "; ".join(f"use `{preferred}` instead of `{command}`" for command, preferred in rewrites)
    lines.append(
        "Note: the renderer does not support some LaTeX constructs used in the formulas of this text; "
        f"replace them in the translated formulas: {pairs}."
    )


def _scoped_terms_guidance(item: TranslationItemContext) -> str:
    return str((item.raw_item or {}).get("_scoped_terms_guidance", "") or "").strip()


def _append_scoped_terms_guidance(lines: list[str], item: TranslationItemContext) -> None:
    # Terminology guidance matched per item is placed in the user message: if placed in system,
    # each request will have different prefixes, losing the provider's prefix cache.
    guidance = _scoped_terms_guidance(item)
    if guidance:
        lines.append(f"Terminology requirements:\n{guidance}")


def _append_text_flow_guidance(lines: list[str], item: TranslationItemContext) -> None:
    structure_role = str((item.metadata or {}).get("structure_role", "") or "").strip().lower()
    if item.toc_entries or structure_role == "table_of_contents" or str(item.semantic_role or "").strip().lower() == "table_of_contents":
        lines.append(
            "Structure hint: the current source text is a table of contents / list of figures or tables. "
            "Translate it line by line, emitting one translated line per source line; translate the leading "
            "label and the title, keep the trailing page number and do not change it; do not merge lines and "
            "do not output explanations."
        )
        return
    if not item.preserve_line_structure_for_prompt or not item.line_texts:
        return
    lines.append(
        "Structure hint: the current source text is a multi-line structured block; the translation should keep "
        "the same number of line breaks and the same line order as much as possible, and must not be merged "
        "into a plain paragraph."
    )


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
        "Below are several passages of body text to translate.",
        "Output one tagged block per passage; apart from that do not output structured data, code blocks, explanations or extra text.",
        "Strict format:",
        "<<<ITEM item_id=the id of the corresponding source text>>>",
        "the translation",
        "<<<END>>>",
    ]
    for item in batch:
        lines.append("")
        lines.append(f"Source text {item.item_id}:")
        lines.append(item.source_for_prompt())
        _append_math_delimiter_damage_hint(lines, item)
        _append_text_flow_guidance(lines, item)
        if item.style_hint:
            lines.append(f"Style hint: {item.style_hint}")
        if item.continuation_group:
            lines.append(
                "This is part of body text continuing across columns or pages; understand it together with the "
                "context and directly output the translation of this whole passage."
            )
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
        "Below is one passage of body text to translate.",
        f"Output only the final {_target_language_name(target_language_name)} translation body; do not output numbering, decision fields, structured data, tags, code blocks or explanations.",
        "",
        "[BEGIN CURRENT SOURCE TEXT]",
        item.source_for_prompt(),
        "[END CURRENT SOURCE TEXT]",
    ]
    _append_math_delimiter_damage_hint(lines, item)
    _append_scoped_terms_guidance(lines, item)
    _append_text_flow_guidance(lines, item)
    if item.style_hint:
        lines.append(f"Style hint: {item.style_hint}")
    if item.continuation_group:
        lines.append(
            "This is part of body text continuing across columns or pages; understand it together with the "
            "context and directly output the translation of this whole passage."
        )
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
        "Below is one passage of body text to translate.",
        f"Output only the final {_target_language_name(target_language_name)} translation body of this passage; do not output numbering, decision fields, structured data, tags, code blocks or explanations.",
        "",
        "[BEGIN CURRENT SOURCE TEXT]",
        item.source_for_prompt(),
        "[END CURRENT SOURCE TEXT]",
    ]
    _append_text_flow_guidance(lines, item)
    if item.style_hint:
        lines.append(f"Style hint: {item.style_hint}")
    if item.continuation_group:
        lines.append(
            "This is part of body text continuing across columns or pages; understand it together with the "
            "context and directly output the translation of this whole passage."
        )
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


def group_member_json_user_prompt(
    item: TranslationItemContext,
    *,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    raw_item = item.raw_item or {}
    member_ids = [
        str(member_id or "").strip()
        for member_id in raw_item.get("translation_unit_member_ids", [])
        if str(member_id or "").strip()
    ]
    if not member_ids:
        member_ids = [item.item_id]
    user_payload: dict[str, Any] = {
        "task": (
            f"Translate the continuation group into {_target_language_name(target_language_name)}. "
            "Return one translated fragment per member_id. Do not add text from neighboring context."
        ),
        "group": {
            "item_id": item.item_id,
            "continuation_group": item.continuation_group,
            "member_ids": member_ids,
            "combined_source_text": item.source_for_prompt(),
        },
        "output_schema": {
            "translated_text": "full translated continuation group",
            "member_translations": [
                {"item_id": "member id from member_ids", "translated_text": "translation for this member only"}
            ],
        },
    }
    if item.style_hint:
        user_payload["group"]["style_hint"] = item.style_hint
    terms_guidance = _scoped_terms_guidance(item)
    if terms_guidance:
        user_payload["group"]["terms_note"] = terms_guidance
    if str(raw_item.get("math_mode", "") or "").strip() == "direct_typst":
        if not has_balanced_unescaped_dollars(item.source_for_prompt()):
            user_payload["group"]["math_delimiter_note"] = MATH_DELIMITER_DAMAGE_HINT
        rewrites = find_mitex_rewrites(item.source_for_prompt())
        if rewrites:
            pairs = "; ".join(f"use `{preferred}` instead of `{command}`" for command, preferred in rewrites)
            user_payload["group"]["math_rewrite_note"] = (
                "The renderer does not support some LaTeX constructs used in the formulas of this text; "
                f"replace them in the translated formulas: {pairs}."
            )
    context_before = item.context_before_for_prompt()
    context_after = item.context_after_for_prompt()
    if context_before:
        user_payload["context_before"] = f"For understanding only, must not be translated into the output: {context_before}"
    if context_after:
        user_payload["context_after"] = f"For understanding only, must not be translated into the output: {context_after}"
    return json.dumps(user_payload, ensure_ascii=False)


__all__ = [
    "batch_json_user_prompt",
    "build_translation_system_prompt",
    "direct_math_guidance",
    "direct_typst_batch_user_prompt",
    "direct_typst_single_user_prompt",
    "group_member_json_user_prompt",
    "plain_text_single_user_prompt",
]
