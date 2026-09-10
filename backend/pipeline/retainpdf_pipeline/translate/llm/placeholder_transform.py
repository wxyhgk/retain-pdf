from __future__ import annotations

from collections import Counter
import re

from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import FORMULA_TOKEN_RE
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import PLACEHOLDER_RE
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence
from retainpdf_pipeline.translate.core.payload.formula_protection import protected_map_from_formula_map
from retainpdf_pipeline.translate.core.payload.formula_protection import protect_glossary_terms


def repair_safe_duplicate_placeholders(source_text: str, translated_text: str) -> str | None:
    source_sequence = placeholder_sequence(source_text)
    if not source_sequence:
        return None
    matches = list(PLACEHOLDER_RE.finditer(translated_text or ""))
    if not matches:
        return None
    translated_sequence = [match.group(0) for match in matches]
    if translated_sequence == source_sequence or len(translated_sequence) <= len(source_sequence):
        return None
    source_inventory = Counter(source_sequence)
    translated_inventory = Counter(translated_sequence)
    for placeholder, count in translated_inventory.items():
        if count < source_inventory.get(placeholder, 0):
            return None
    if any(placeholder not in source_inventory for placeholder in translated_inventory):
        return None

    kept_match_indexes: list[int] = []
    cursor = 0
    for placeholder in source_sequence:
        while cursor < len(translated_sequence) and translated_sequence[cursor] != placeholder:
            cursor += 1
        if cursor >= len(translated_sequence):
            return None
        kept_match_indexes.append(cursor)
        cursor += 1

    if len(kept_match_indexes) == len(matches):
        return None

    keep_set = set(kept_match_indexes)
    rebuilt_parts: list[str] = []
    prev_end = 0
    for index, match in enumerate(matches):
        rebuilt_parts.append(translated_text[prev_end:match.start()])
        if index in keep_set:
            rebuilt_parts.append(match.group(0))
        prev_end = match.end()
    rebuilt_parts.append(translated_text[prev_end:])

    repaired_text = "".join(rebuilt_parts)
    repaired_text = re.sub(r"[ \t]{2,}", " ", repaired_text)
    repaired_text = re.sub(r"\s+([,.;:!?])", r"\1", repaired_text)
    if placeholder_sequence(repaired_text) != source_sequence:
        return None
    return repaired_text.strip()


def has_formula_placeholders(item: dict) -> bool:
    if is_direct_math_mode(item):
        return False
    return bool(FORMULA_TOKEN_RE.findall(unit_source_text(item)))


def placeholder_alias_maps(item: dict) -> tuple[dict[str, str], dict[str, str]]:
    source_sequence = placeholder_sequence(unit_source_text(item))
    source_set = set(source_sequence)
    original_to_alias: dict[str, str] = {}
    alias_to_original: dict[str, str] = {}
    next_alias_id = 1
    for placeholder in dict.fromkeys(source_sequence):
        alias = f"@@P{next_alias_id}@@"
        while alias in source_set or alias in alias_to_original:
            next_alias_id += 1
            alias = f"@@P{next_alias_id}@@"
        original_to_alias[placeholder] = alias
        alias_to_original[alias] = placeholder
        next_alias_id += 1
    return original_to_alias, alias_to_original


def item_with_runtime_hard_glossary(item: dict, glossary_entries: list[dict] | list[object] | None) -> dict:
    normalized_map = list(item.get("translation_unit_protected_map") or item.get("protected_map") or [])
    if not normalized_map and item.get("translation_unit_formula_map"):
        normalized_map = protected_map_from_formula_map(item.get("translation_unit_formula_map") or [])
    elif not normalized_map and item.get("formula_map"):
        normalized_map = protected_map_from_formula_map(item.get("formula_map") or [])
    protected_text, protected_map = protect_glossary_terms(
        unit_source_text(item),
        glossary_entries=glossary_entries,
        existing_map=normalized_map,
    )
    if protected_text == unit_source_text(item) and protected_map == normalized_map:
        return dict(item)
    updated = dict(item)
    updated["translation_unit_protected_source_text"] = protected_text
    updated["protected_source_text"] = protected_text
    updated["translation_unit_protected_map"] = protected_map
    updated["protected_map"] = protected_map
    return updated


def replace_placeholders(text: str, mapping: dict[str, str]) -> str:
    replaced = text or ""
    for source, target in mapping.items():
        replaced = replaced.replace(source, target)
    return replaced


def item_with_placeholder_aliases(item: dict, mapping: dict[str, str]) -> dict:
    aliased = dict(item)
    for key in (
        "source_text",
        "protected_source_text",
        "mixed_original_protected_source_text",
        "translation_unit_protected_source_text",
        "group_protected_source_text",
    ):
        if key in aliased and aliased.get(key):
            aliased[key] = replace_placeholders(str(aliased.get(key) or ""), mapping)
    return aliased


def restore_placeholder_aliases(
    result: dict[str, dict[str, str]],
    mapping: dict[str, str],
) -> dict[str, dict[str, str]]:
    restored: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        translated_text = replace_placeholders(str(payload.get("translated_text", "") or ""), mapping)
        restored_payload = result_entry(str(payload.get("decision", "translate") or "translate"), translated_text)
        if payload.get("final_status"):
            restored_payload["final_status"] = str(payload.get("final_status", "") or restored_payload["final_status"])
        restored[item_id] = restored_payload
    return restored


def placeholder_stability_guidance(item: dict, source_sequence: list[str]) -> str:
    if not source_sequence:
        return ""
    return (
        "Placeholder safety rules for this item:\n"
        f"- Allowed placeholders exactly: {', '.join(source_sequence)}\n"
        f"- Placeholder sequence in source_text: {' -> '.join(source_sequence)}\n"
        "- Keep placeholders as atomic tokens.\n"
        "- Do not invent, renumber, duplicate, omit, split, or reorder placeholders.\n"
        "- If a placeholder stands for a whole formula or expression, keep that placeholder as one unit."
    )


__all__ = [
    "has_formula_placeholders",
    "item_with_placeholder_aliases",
    "item_with_runtime_hard_glossary",
    "placeholder_alias_maps",
    "placeholder_stability_guidance",
    "repair_safe_duplicate_placeholders",
    "replace_placeholders",
    "restore_placeholder_aliases",
]
