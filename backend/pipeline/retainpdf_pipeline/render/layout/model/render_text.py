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


def _unit_kind(item: dict) -> str:
    return str(item.get("translation_unit_kind", "") or "").strip().lower()


def _continuation_group_id(item: dict) -> str:
    return str(item.get("continuation_group") or item.get("continuation_group_id") or "")


def _uses_member_translation(item: dict) -> bool:
    """组里各块排自己那一段：接续组，以及同页摘要组（aggregate_geometry，几块一起翻、译文按块分开）。

    摘要组以前每块都拿整组的译文，同一段话排两遍，下面那块挤成小字压住页码（2026-11-02 481 页的书第 395 页，
    一章开头的两段）。块自己没有那一段时照旧用整组的。Typst 路线在 prepare_render_payloads_by_page 里
    自己按框重新切，不经过这里。"""
    return bool(_continuation_group_id(item)) or (
        str(item.get("translation_group_strategy", "") or "").strip() == "aggregate_geometry"
    )


def member_translation_text(item: dict) -> str:
    return str(item.get("protected_translated_text") or item.get("translated_text") or "").strip()


def render_protected_translation_text(item: dict) -> str:
    """这一块要排的译文（占位符没还原）。各路线只认这一份规则（2026-11-02 以前 render_item 另有一份，已经走样）。"""
    if _unit_kind(item) != "group" and not _continuation_group_id(item):
        text = (
            item.get("protected_translated_text")
            or item.get("translated_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("translation_unit_translated_text")
            or ""
        )
    elif _uses_member_translation(item) and member_translation_text(item):
        text = member_translation_text(item)
    else:
        text = (
            item.get("translation_unit_protected_translated_text")
            or item.get("group_protected_translated_text")
            or item.get("protected_translated_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        )
    return str(text or "").strip()


def render_protected_source_text(item: dict) -> str:
    """这一块的原文（占位符没还原）：组里的块取整组的原文。"""
    if _unit_kind(item) != "group":
        text = (
            item.get("protected_source_text")
            or item.get("source_text")
            or item.get("translation_unit_protected_source_text")
            or item.get("translation_unit_source_text")
            or ""
        )
    else:
        text = (
            item.get("translation_unit_protected_source_text")
            or item.get("group_protected_source_text")
            or item.get("protected_source_text")
            or item.get("translation_unit_source_text")
            or item.get("group_source_text")
            or item.get("source_text")
            or ""
        )
    return str(text or "").strip()


def restore_render_protected_text(text: str, item: dict) -> str:
    current = str(text or "").strip()
    if not current or not _has_protected_token(current):
        return current
    restored = _restore_protected_tokens(current, _render_protected_map(item))
    return str(restored or "").strip()


def get_render_protected_text(item: dict) -> str:
    """排出来的文字（占位符已还原）。seed_render_fields 写过 render_protected_text 就用它，没写过按同一套规则现算。"""
    if should_skip_display_math_render(item):
        return ""
    if "render_protected_text" in item:
        return restore_render_protected_text(str(item.get("render_protected_text", "") or "").strip(), item)
    translated = render_protected_translation_text(item)
    if not translated and should_render_source_block(item):
        return restore_render_protected_text(_render_source_text(item), item)
    return restore_render_protected_text(translated, item)


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
    """seed_render_fields 写下的 render_source_text 优先，没有就按同一套规则取原文。"""
    return str(item.get("render_source_text") or "").strip() or render_protected_source_text(item)


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


def should_render_source_block(item: dict) -> bool:
    """没有译文时要不要按原文重排：公式块、带公式或 LaTeX 命令的块。

    以前 render_item 那一份看 LaTeX 命令（`\\frac`），这一份看有没有反斜杠（`50\\%` 也算），同一块两条路结论不同；
    统一成看 LaTeX 命令（seed_render_fields 一直用的那一条，rpr_fit 和 Typst 准备阶段都走它）。"""
    if should_skip_display_math_render(item):
        return False
    # 翻译失败的块留原文：底图本来就没去掉它（清理计划把 failed 当没翻译），拿 OCR 原文重排一遍盖上去
    # 只会更差——481 页的书第 379 页一张带 Goldstone 图的表被 OCR 当成正文，翻译失败后整块按 OCR 文字重排，
    # 图没了、最后一个公式原样印成源码（2026-11-02）。
    if str(item.get("final_status", "") or "").strip() == "failed":
        return False
    if not item.get("should_translate", True) and _skip_reason(item) in MODEL_KEEP_ORIGIN_REASONS:
        return False
    source_text = _render_source_text(item)
    if not source_text:
        return False
    if block_class(item) == "formula":
        return True
    analysis = analyze_text(source_text)
    return analysis.raw_math_count > 0 or analysis.latex_command_count > 0


def _skip_reason(item: dict) -> str:
    return str(item.get("skip_reason", "") or item.get("classification_label", "") or "").strip().lower()
