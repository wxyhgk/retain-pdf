"""Render-private prewarm entry helpers.

Stage boundary note: this module owns the render-source prewarm flow
(document analysis + ``start_render_source_prewarm``). It lives under
``render/workflow`` so OCR/translate stages never import it directly --
they hand off through files (translation artifacts + prewarm manifest) or
invoke ``python -m retainpdf_pipeline.render`` as a separate process.

The old ``retainpdf_pipeline.runtime.pipeline.render_preprocess`` compat
shim was removed; devtools tests import these helpers directly.
"""

from __future__ import annotations

import time
from pathlib import Path

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.render.analysis.document import build_render_document_analysis
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmHandle
from retainpdf_pipeline.render.source.prewarm import prewarm_manifest_path_from_artifacts_dir
from retainpdf_pipeline.render.source.prewarm import start_render_source_prewarm
from retainpdf_pipeline.render.workflow.translation_records import build_translation_record
from retainpdf_pipeline.render.workflow.source_page_records import extract_text_items
from retainpdf_pipeline.render.workflow.source_page_records import get_page_count
from retainpdf_pipeline.render.workflow.source_page_records import load_ocr_json


def build_source_render_preprocess_pages(
    *,
    source_json_path: Path,
    start_page: int,
    end_page: int,
    math_mode: str = "direct_typst",
) -> dict[int, list[dict]]:
    data = load_ocr_json(source_json_path)
    page_count = get_page_count(data)
    start = max(0, int(start_page))
    stop = page_count - 1 if int(end_page) < 0 else min(int(end_page), page_count - 1)
    pages: dict[int, list[dict]] = {}
    for page_idx in range(start, stop + 1):
        items = extract_text_items(data, page_idx=page_idx)
        pages[page_idx] = [
            build_translation_record(item, math_mode=math_mode)
            for item in items
        ]
    return pages


def run_ocr_render_preprocess(
    *,
    source_json_path: Path,
    source_pdf_path: Path,
    output_pdf_path: Path,
    artifacts_dir: Path,
    render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str,
    math_mode: str = "direct_typst",
) -> Path | None:
    handle = start_ocr_render_preprocess(
        source_json_path=source_json_path,
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        artifacts_dir=artifacts_dir,
        render_mode=render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
        math_mode=math_mode,
    )
    return handle.wait() if handle is not None else None


def start_ocr_render_preprocess(
    *,
    source_json_path: Path,
    source_pdf_path: Path,
    output_pdf_path: Path,
    artifacts_dir: Path,
    render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str,
    math_mode: str = "direct_typst",
) -> RenderPrewarmHandle | None:
    pages = build_source_render_preprocess_pages(
        source_json_path=source_json_path,
        start_page=start_page,
        end_page=end_page,
        math_mode=math_mode,
    )
    if not pages:
        return None
    document_analysis = build_render_document_analysis(
        source_pdf_path=source_pdf_path,
        translated_pages=pages,
        start_page=start_page,
        end_page=end_page,
    )
    return start_render_source_prewarm(
        RenderPrewarmSpec(
            source_pdf_path=source_pdf_path,
            output_pdf_path=output_pdf_path,
            artifacts_dir=artifacts_dir,
            translated_pages=pages,
            render_mode=render_mode,
            start_page=start_page,
            end_page=end_page,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
            document_analysis=document_analysis,
            include_source_cleanup=False,
        )
    )


def run_post_translation_render_prewarm(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    artifacts_dir: Path,
    translated_pages: dict,
    render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str,
) -> dict:
    if not translated_pages:
        return {"ready": False, "reason": "empty_translated_pages"}
    manifest_path = prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
    started = time.perf_counter()
    emit_stage_progress(
        stage="render_preprocess",
        substage="render_prewarm",
        message="正在准备渲染资源",
        progress_current=1,
        progress_total=3,
        payload={"user_stage": "render", "progress_unit": "step"},
    )
    try:
        document_analysis = build_render_document_analysis(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            start_page=start_page,
            end_page=end_page,
        )
        handle = start_render_source_prewarm(
            RenderPrewarmSpec(
                source_pdf_path=source_pdf_path,
                output_pdf_path=output_pdf_path,
                artifacts_dir=artifacts_dir,
                translated_pages=translated_pages,
                render_mode=render_mode,
                start_page=start_page,
                end_page=end_page,
                pdf_compress_dpi=pdf_compress_dpi,
                source_cleanup_strategy=source_cleanup_strategy,
                document_analysis=document_analysis,
                include_source_cleanup=True,
            )
        )
        result_path = handle.wait()
        ready = result_path is not None and Path(result_path).exists()
        return {
            "ready": ready,
            "manifest_path": str(result_path or manifest_path),
            "elapsed": time.perf_counter() - started,
            "source_cleanup_strategy": source_cleanup_strategy,
        }
    except Exception as exc:
        error_type = type(exc).__name__
        error = str(exc)
        print(f"post-translation render prewarm failed: {error_type}: {error}", flush=True)
        emit_stage_progress(
            stage="render_preprocess",
            substage="render_prewarm",
            message=f"渲染资源预热失败，将在渲染阶段同步准备: {error_type}",
            progress_current=1,
            progress_total=3,
            payload={
                "user_stage": "render",
                "progress_unit": "step",
                "ready": False,
                "failure_category": "render_prewarm",
                "error_type": error_type,
                "error": error,
            },
        )
        return {
            "ready": False,
            "manifest_path": str(manifest_path),
            "elapsed": time.perf_counter() - started,
            "failure_category": "render_prewarm",
            "error_type": error_type,
            "error": error,
        }


__all__ = [
    "build_source_render_preprocess_pages",
    "prewarm_manifest_path_from_artifacts_dir",
    "run_post_translation_render_prewarm",
    "run_ocr_render_preprocess",
    "start_ocr_render_preprocess",
]
