from __future__ import annotations

import os
from pathlib import Path
from typing import Callable

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_overlay_pdf
from retainpdf_pipeline.render.output.typst.compiler import TypstCompileError
from retainpdf_pipeline.render.output.typst.shared import TYPST_OVERLAY_DIR
from retainpdf_pipeline.render.output.typst.sanitize_steps import find_bad_item_indices
from retainpdf_pipeline.render.output.typst.sanitize_steps import replace_item_math_tokens_with_plain_text
from retainpdf_pipeline.render.output.typst.sanitize_steps import item_contains_raw_math
from retainpdf_pipeline.render.output.typst.sanitize_steps import try_selective_formula_strip
from retainpdf_pipeline.render.output.typst.sanitize_steps import try_selective_llm_repair
from retainpdf_pipeline.render.output.typst.sanitize_steps import try_selective_math_token_plain_text
from retainpdf_pipeline.render.output.typst.sanitize_steps import try_selective_plain_text
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress

TypstRepairRequestFn = Callable[..., str]


def _force_plain_text_items_preserving_math(translated_items: list[dict]) -> list[dict]:
    patched: list[dict] = []
    for item in translated_items:
        if item_contains_raw_math(item):
            patched.append(replace_item_math_tokens_with_plain_text(item))
        else:
            patched.append(dict(item, _force_plain_line=True))
    return patched


def _llm_repair_enabled() -> bool:
    return os.environ.get("RETAIN_RENDER_TYPST_LLM_REPAIR", "1").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def sanitize_items_for_typst_compile(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
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
) -> list[dict]:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    if diagnostics is not None:
        diagnostics.setdefault("stem", stem)
        diagnostics.setdefault("work_dir", str(work_dir))
    try:
        compile_typst_overlay_pdf(
            page_width,
            page_height,
            translated_items,
            stem=stem,
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )
        if diagnostics is not None:
            diagnostics["final_mode"] = "original"
        return translated_items
    except RuntimeError as page_error:
        if diagnostics is not None:
            diagnostics["initial_compile_error"] = (
                page_error.to_dict() if isinstance(page_error, TypstCompileError) else str(page_error)
            )
        bad_indices = find_bad_item_indices(
            page_width,
            page_height,
            translated_items,
            stem=stem,
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
            failure_details=diagnostics.setdefault("probe_failures", []) if diagnostics is not None else None,
        )
        if diagnostics is not None:
            diagnostics["bad_item_indices"] = list(bad_indices)

        if bad_indices:
            print(f"typst selective fallback: {stem} block_indices={bad_indices}", flush=True)
            patched_items = try_selective_formula_strip(
                page_width,
                page_height,
                translated_items,
                bad_indices,
                stem=stem,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
                diagnostics=diagnostics,
            )
            if patched_items is not None:
                if diagnostics is not None:
                    diagnostics["final_mode"] = "selective_formula_strip"
                return patched_items

            if _llm_repair_enabled():
                llm_patched_items = try_selective_llm_repair(
                    page_width,
                    page_height,
                    translated_items,
                    bad_indices,
                    stem=stem,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    font_family=font_family,
                    include_cover_rect=include_cover_rect,
                    font_paths=font_paths,
                    work_dir=work_dir,
                    diagnostics=diagnostics,
                    request_chat_content_fn=request_chat_content_fn,
                )
                if llm_patched_items is not None:
                    if diagnostics is not None:
                        diagnostics["final_mode"] = "selective_llm_repair"
                    return llm_patched_items
            elif diagnostics is not None:
                diagnostics["selective_llm_repair_skipped"] = "disabled_by_env"

            patched_items = try_selective_math_token_plain_text(
                page_width,
                page_height,
                translated_items,
                bad_indices,
                stem=stem,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
                diagnostics=diagnostics,
            )
            if patched_items is not None:
                if diagnostics is not None:
                    diagnostics["final_mode"] = "selective_math_token_plain_text"
                return patched_items

            patched_items = try_selective_plain_text(
                page_width,
                page_height,
                translated_items,
                bad_indices,
                stem=stem,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
                diagnostics=diagnostics,
            )
            if patched_items is not None:
                if diagnostics is not None:
                    diagnostics["final_mode"] = "selective_plain_text"
                return patched_items

        print(f"typst page fallback to plain text: {stem}", flush=True)
        print(str(page_error), flush=True)
        patched_items = _force_plain_text_items_preserving_math(translated_items)
        try:
            compile_typst_overlay_pdf(
                page_width,
                page_height,
                patched_items,
                stem=f"{stem}-plain",
                font_family=font_family,
                include_cover_rect=include_cover_rect,
                font_paths=font_paths,
                work_dir=work_dir,
            )
        except RuntimeError as plain_error:
            if diagnostics is not None:
                diagnostics["plain_page_fallback_error"] = (
                    plain_error.to_dict() if isinstance(plain_error, TypstCompileError) else str(plain_error)
                )
            raise
        if diagnostics is not None:
            diagnostics["final_mode"] = "force_plain_text"
        return patched_items


def compile_overlay_pdf_resilient(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
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
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_items = sanitize_items_for_typst_compile(
        page_width,
        page_height,
        translated_items,
        stem=stem,
        api_key=api_key,
        model=model,
        base_url=base_url,
        font_family=font_family,
        include_cover_rect=include_cover_rect,
        font_paths=font_paths,
        work_dir=work_dir,
        diagnostics=diagnostics,
        request_chat_content_fn=request_chat_content_fn,
    )
    return compile_typst_overlay_pdf(
        page_width,
        page_height,
        sanitized_items,
        stem=f"{stem}-final",
        font_family=font_family,
        include_cover_rect=include_cover_rect,
        font_paths=font_paths,
        work_dir=work_dir,
    )


def sanitize_page_specs_for_typst_book_background(
    page_specs: list[tuple[int, float, float, list[dict]]],
    stem: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    page_diagnostics: list[dict] | None = None,
    page_indices: set[int] | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> list[tuple[int, float, float, list[dict]]]:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_specs: list[tuple[int, float, float, list[dict]]] = []
    for page_index, (source_page_idx, page_width, page_height, translated_items) in enumerate(page_specs):
        if page_indices is not None and page_index not in page_indices:
            sanitized_specs.append((source_page_idx, page_width, page_height, translated_items))
            continue
        diagnostics = (
            {"page_index": page_index, "source_page_idx": source_page_idx, "stem": f"{stem}-page-{page_index:03d}"}
            if page_diagnostics is not None
            else None
        )
        sanitized_items = sanitize_items_for_typst_compile(
            page_width,
            page_height,
            translated_items,
            stem=f"{stem}-page-{page_index:03d}",
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            include_cover_rect=True,
            font_paths=font_paths,
            work_dir=work_dir,
            diagnostics=diagnostics,
            request_chat_content_fn=request_chat_content_fn,
        )
        if diagnostics is not None:
            page_diagnostics.append(diagnostics)
        sanitized_specs.append((source_page_idx, page_width, page_height, sanitized_items))
    return sanitized_specs


def sanitize_page_specs_for_typst_book_overlay(
    page_specs: list[tuple[int, float, float, list[dict], str]],
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    page_diagnostics: list[dict] | None = None,
    overlay_indices: set[int] | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> list[tuple[int, float, float, list[dict], str]]:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    sanitized_specs: list[tuple[int, float, float, list[dict], str]] = []
    total_pages = len(page_specs)
    for page_index, (page_idx, page_width, page_height, translated_items, page_stem) in enumerate(page_specs):
        if overlay_indices is not None and page_index not in overlay_indices:
            sanitized_specs.append((page_idx, page_width, page_height, translated_items, page_stem))
            continue
        emit_stage_progress(
            stage="rendering",
            substage="render_pages",
            message=f"正在检查 Typst 兼容性，第 {page_index + 1}/{total_pages} 页",
            progress_current=page_index + 1,
            progress_total=total_pages,
            payload={
                "user_stage": "render",
                "progress_unit": "page",
                "render_stage": "typst_sanitize",
                "page_index": page_idx,
            },
        )
        diagnostics = {"page_index": page_idx, "stem": page_stem} if page_diagnostics is not None else None
        sanitized_items = sanitize_items_for_typst_compile(
            page_width,
            page_height,
            translated_items,
            stem=page_stem,
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            work_dir=work_dir / "page-overlays" / page_stem,
            diagnostics=diagnostics,
            request_chat_content_fn=request_chat_content_fn,
        )
        if diagnostics is not None:
            page_diagnostics.append(diagnostics)
        sanitized_specs.append((page_idx, page_width, page_height, sanitized_items, page_stem))
    return sanitized_specs
