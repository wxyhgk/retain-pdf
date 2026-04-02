from __future__ import annotations

from pathlib import Path

from foundation.config import fonts
from services.rendering.typst.compiler import compile_typst_overlay_pdf
from services.rendering.typst.repair import repair_items_with_llm_for_typst
from services.rendering.typst.shared import force_plain_text_item_at_index
from services.rendering.typst.shared import strip_formula_commands_for_item_at_index


def find_bad_item_indices(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
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
        except RuntimeError:
            bad_indices.append(index)
    return bad_indices


def try_selective_formula_strip(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    bad_indices: list[int],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
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
    except RuntimeError:
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
    include_cover_rect: bool = True,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> list[dict] | None:
    patched_items = repair_items_with_llm_for_typst(
        translated_items,
        bad_indices,
        stem=stem,
        api_key=api_key,
        model=model,
        base_url=base_url,
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
    except RuntimeError:
        return None


def try_selective_plain_text(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    bad_indices: list[int],
    *,
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = True,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> list[dict] | None:
    patched_items = translated_items
    for index in bad_indices:
        patched_items = force_plain_text_item_at_index(patched_items, index)
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
    except RuntimeError:
        return None
