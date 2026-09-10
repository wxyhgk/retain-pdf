from __future__ import annotations

from retainpdf_pipeline.render.semantics.item_view import block_class
from retainpdf_pipeline.render.layout.text_analysis import analyze_text

MODEL_KEEP_ORIGIN_REASONS = {"skip_model_keep_origin"}


def _protected_map_from_formula_map(formula_map: list[dict]) -> list[dict]:
    from retainpdf_pipeline.render.layout.protected_tokens import protected_map_from_formula_map

    return protected_map_from_formula_map(formula_map)


def _restore_protected_tokens(text: str, protected_map: list[dict]) -> str:
    from retainpdf_pipeline.render.layout.protected_tokens import restore_protected_tokens

    return restore_protected_tokens(text, protected_map)


def _has_protected_token(text: str) -> bool:
    from retainpdf_pipeline.render.layout.protected_tokens import protected_token_re

    return bool(protected_token_re().search(text))


def _render_protected_map(item: dict) -> list[dict]:
    unit_kind = str(item.get("translation_unit_kind", "") or "").strip().lower()
    if unit_kind != "group":
        protected_map = (
            item.get("render_formula_map")
            or item.get("protected_map")
            or item.get("formula_map")
            or []
        )
        if protected_map and isinstance(protected_map, list) and any(isinstance(entry, dict) and "token_tag" in entry for entry in protected_map):
            return list(protected_map)
        return _protected_map_from_formula_map(protected_map if isinstance(protected_map, list) else [])
    protected_map = (
        item.get("translation_unit_protected_map")
        or item.get("render_formula_map")
        or item.get("translation_unit_formula_map")
        or item.get("group_formula_map")
        or item.get("protected_map")
        or item.get("formula_map")
        or []
    )
    if protected_map and isinstance(protected_map, list) and any(isinstance(entry, dict) and "token_tag" in entry for entry in protected_map):
        return list(protected_map)
    return _protected_map_from_formula_map(protected_map if isinstance(protected_map, list) else [])


def _should_use_unit_translation(item: dict) -> bool:
    unit_kind = str(item.get("translation_unit_kind", "") or "").strip().lower()
    return unit_kind == "group" or bool(item.get("continuation_group") or item.get("continuation_group_id"))


def _member_translation_text(item: dict) -> str:
    return str(item.get("protected_translated_text") or item.get("translated_text") or "").strip()


def restore_render_protected_text(text: str, item: dict) -> str:
    current = str(text or "").strip()
    if not current or not _has_protected_token(current):
        return current
    restored = _restore_protected_tokens(current, _render_protected_map(item))
    return str(restored or "").strip()


def get_render_protected_text(item: dict) -> str:
    if should_skip_display_math_render(item):
        return ""
    if "render_protected_text" in item:
        return restore_render_protected_text(str(item.get("render_protected_text", "") or "").strip(), item)
    if not _should_use_unit_translation(item):
        translated = str(
            item.get("protected_translated_text")
            or item.get("translated_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("translation_unit_translated_text")
            or ""
        ).strip()
        if not translated and _should_render_source_block(item):
            return restore_render_protected_text(_render_source_text(item), item)
        return restore_render_protected_text(
            translated,
            item,
        )
    if (item.get("continuation_group") or item.get("continuation_group_id")) and _member_translation_text(item):
        return restore_render_protected_text(_member_translation_text(item), item)
    return restore_render_protected_text(
        str(
            item.get("translation_unit_protected_translated_text")
            or item.get("group_protected_translated_text")
            or item.get("protected_translated_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        ).strip(),
        item,
    )


def get_render_translation_overlay_text(item: dict) -> str:
    if should_skip_display_math_render(item):
        return ""
    if "render_protected_text" in item:
        return restore_render_protected_text(str(item.get("render_protected_text", "") or "").strip(), item)
    if not _should_use_unit_translation(item):
        return restore_render_protected_text(
            str(
                item.get("protected_translated_text")
                or item.get("translated_text")
                or item.get("translation_unit_protected_translated_text")
                or item.get("translation_unit_translated_text")
                or ""
            ).strip(),
            item,
        )
    if (item.get("continuation_group") or item.get("continuation_group_id")) and _member_translation_text(item):
        return restore_render_protected_text(_member_translation_text(item), item)
    return restore_render_protected_text(
        str(
            item.get("translation_unit_protected_translated_text")
            or item.get("group_protected_translated_text")
            or item.get("protected_translated_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        ).strip(),
        item,
    )


def get_render_formula_map(item: dict) -> list[dict]:
    formula_map = (
        item.get("render_formula_map")
        or item.get("translation_unit_formula_map")
        or item.get("group_formula_map")
        or item.get("formula_map")
        or []
    )
    return list(formula_map) if isinstance(formula_map, list) else []


def _render_source_text(item: dict) -> str:
    return str(
        item.get("render_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or item.get("translation_unit_protected_source_text")
        or item.get("translation_unit_source_text")
        or ""
    ).strip()


def _should_render_source_when_untranslated(item: dict) -> bool:
    if item.get("should_translate", True):
        return False
    if _skip_reason(item) in MODEL_KEEP_ORIGIN_REASONS:
        return False
    return _should_render_source_block(item)


def should_skip_display_math_render(item: dict) -> bool:
    if item.get("should_translate", True):
        return False
    source_text = _render_source_text(item)
    if not source_text:
        return False
    skip_reason = _skip_reason(item)
    if block_class(item) == "formula":
        return True
    analysis = analyze_text(source_text)
    if skip_reason in {"skip_display_formula", "skip_model_keep_origin"} and analysis.has_display_math and not analysis.plain_text.strip():
        return True
    return False


def _should_render_source_block(item: dict) -> bool:
    if should_skip_display_math_render(item):
        return False
    if not item.get("should_translate", True) and _skip_reason(item) in MODEL_KEEP_ORIGIN_REASONS:
        return False
    source_text = _render_source_text(item)
    if not source_text:
        return False
    if block_class(item) == "formula":
        return True
    analysis = analyze_text(source_text)
    return analysis.raw_math_count > 0 or "\\" in source_text


def _skip_reason(item: dict) -> str:
    return str(item.get("skip_reason", "") or item.get("classification_label", "") or "").strip().lower()
