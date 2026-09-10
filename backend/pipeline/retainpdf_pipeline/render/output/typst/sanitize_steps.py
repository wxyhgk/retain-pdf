from __future__ import annotations

from pathlib import Path
from typing import Callable

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.layout.model.render_text import get_render_protected_text
from retainpdf_pipeline.render.layout.payload.formula_cost import approx_formula_visible_text
from retainpdf_pipeline.render.layout.text_analysis import RAW_MATH_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_analysis import analyze_text
from retainpdf_pipeline.render.layout.text_analysis import math_token_body
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_overlay_pdf
from retainpdf_pipeline.render.output.typst.compiler import TypstCompileError
from retainpdf_pipeline.render.output.typst.repair import repair_items_with_llm_for_typst
from retainpdf_pipeline.render.output.typst.shared import force_plain_text_item_at_index
from retainpdf_pipeline.render.output.typst.shared import strip_formula_commands_for_item_at_index

TypstRepairRequestFn = Callable[..., str]


def item_contains_raw_math(item: dict) -> bool:
    return analyze_text(get_render_protected_text(item)).stats.raw_math_count > 0


def _plain_math_token_text(expr: str) -> str:
    text = approx_formula_visible_text(expr)
    if text:
        return text
    return " ".join(str(expr or "").split())


def _replace_math_tokens_with_plain_text(text: str) -> str:
    chunks: list[str] = []
    for token in analyze_text(text or "").tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            chunks.append(_plain_math_token_text(math_token_body(token)))
        else:
            chunks.append(token.value)
    return "".join(chunks)


def replace_item_math_tokens_with_plain_text(item: dict) -> dict:
    text = get_render_protected_text(item)
    plain_math_text = _replace_math_tokens_with_plain_text(text)
    cloned = dict(item)
    for field in (
        "render_protected_text",
        "translation_unit_protected_translated_text",
        "protected_translated_text",
        "translated_text",
        "group_protected_translated_text",
        "group_translated_text",
    ):
        if field in cloned:
            cloned[field] = plain_math_text
    if not any(field in cloned for field in ("render_protected_text", "protected_translated_text", "translated_text")):
        cloned["render_protected_text"] = plain_math_text
    cloned["_typst_math_token_plain_text"] = True
    cloned.pop("_force_plain_line", None)
    return cloned


def find_bad_item_indices(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    failure_details: list[dict] | None = None,
) -> list[int]:
    bad_indices: list[int] = []
    for index in range(len(translated_items)):
        try:
            compile_typst_overlay_pdf(
                page_width,
                page_height,
                [translated_items[index]],
                stem=f"{stem}-probe-{index:03d}",
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
            )
        except RuntimeError as exc:
            bad_indices.append(index)
            if failure_details is not None:
                detail = {"item_index": index, "item_id": translated_items[index].get("item_id", ""), "error": str(exc)}
                if isinstance(exc, TypstCompileError):
                    detail["compile_error"] = exc.to_dict()
                failure_details.append(detail)
    return bad_indices


def try_selective_formula_strip(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    bad_indices: list[int],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    diagnostics: dict | None = None,
) -> list[dict] | None:
    patched_items = translated_items
    for index in bad_indices:
        patched_items = strip_formula_commands_for_item_at_index(patched_items, index)
    try:
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            patched_items,
            stem=f"{stem}-selective-strip",
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return patched_items
    except RuntimeError as exc:
        if diagnostics is not None:
            diagnostics["selective_formula_strip_error"] = exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc)
        return None


def try_selective_llm_repair(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    bad_indices: list[int],
    *,
    stem: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    diagnostics: dict | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> list[dict] | None:
    patched_items = repair_items_with_llm_for_typst(
        translated_items,
        bad_indices,
        stem=stem,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_chat_content_fn=request_chat_content_fn,
    )
    if patched_items == translated_items:
        return None
    try:
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            patched_items,
            stem=f"{stem}-selective-llm",
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return patched_items
    except RuntimeError as exc:
        if diagnostics is not None:
            diagnostics["selective_llm_repair_error"] = exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc)
        return None


def try_selective_math_token_plain_text(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    bad_indices: list[int],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    diagnostics: dict | None = None,
) -> list[dict] | None:
    patched_items: list[dict] = []
    changed_indices: list[int] = []
    bad_index_set = set(bad_indices)
    for index, item in enumerate(translated_items):
        if index in bad_index_set and item_contains_raw_math(item):
            patched_items.append(replace_item_math_tokens_with_plain_text(item))
            changed_indices.append(index)
        else:
            patched_items.append(item)
    if not changed_indices:
        return None
    try:
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            patched_items,
            stem=f"{stem}-math-token-plain",
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        if diagnostics is not None:
            diagnostics["math_token_plain_text_indices"] = changed_indices
        return patched_items
    except RuntimeError as exc:
        if diagnostics is not None:
            diagnostics["math_token_plain_text_error"] = exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc)
        return None


def try_selective_plain_text(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    bad_indices: list[int],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    diagnostics: dict | None = None,
) -> list[dict] | None:
    patched_items = translated_items
    skipped_math_indices: list[int] = []
    for index in bad_indices:
        if item_contains_raw_math(patched_items[index]):
            skipped_math_indices.append(index)
            continue
        patched_items = force_plain_text_item_at_index(patched_items, index)
    if skipped_math_indices and diagnostics is not None:
        diagnostics["selective_plain_text_skipped_math_indices"] = skipped_math_indices
    if len(skipped_math_indices) == len(bad_indices):
        return None
    try:
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            patched_items,
            stem=f"{stem}-selective-plain",
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        return patched_items
    except RuntimeError as exc:
        if diagnostics is not None:
            diagnostics["selective_plain_text_error"] = exc.to_dict() if isinstance(exc, TypstCompileError) else str(exc)
        return None
