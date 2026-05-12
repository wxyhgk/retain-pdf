from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import layout
from foundation.shared.job_dirs import job_dirs_from_explicit_args
from foundation.shared.stage_specs import build_stage_invocation_metadata
from foundation.shared.stage_specs import RenderStageSpec
from foundation.shared.stage_specs import resolve_credential_ref
from foundation.shared.tee_output import enable_job_log_capture
from runtime.pipeline.render_stage import run_render_stage
from services.pipeline_shared.contracts import format_stdout_kv
from services.pipeline_shared.contracts import PIPELINE_SUMMARY_FILE_NAME
from services.pipeline_shared.contracts import STDOUT_LABEL_EVENTS_JSONL
from services.pipeline_shared.contracts import STDOUT_LABEL_JOB_ROOT
from services.pipeline_shared.contracts import STDOUT_LABEL_OUTPUT_PDF
from services.pipeline_shared.contracts import STDOUT_LABEL_SOURCE_PDF
from services.pipeline_shared.contracts import STDOUT_LABEL_SUMMARY
from services.pipeline_shared.contracts import STDOUT_LABEL_TRANSLATIONS_DIR
from services.pipeline_shared.events import emit_artifact_published
from services.pipeline_shared.events import emit_stage_transition
from services.pipeline_shared.events import PipelineEventWriter
from services.pipeline_shared.events import pipeline_event_writer_scope
from services.pipeline_shared.io import save_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render translated PDF from source PDF and translation artifacts only.",
    )
    parser.add_argument("--spec", type=str, required=True, help="Path to render stage spec JSON.")
    return parser.parse_args()


def _args_from_spec(spec: RenderStageSpec) -> SimpleNamespace:
    job_dirs = spec.job_dirs
    return SimpleNamespace(
        job_root=str(job_dirs.root),
        source_dir=str(job_dirs.source_dir),
        ocr_dir=str(job_dirs.ocr_dir),
        translated_dir=str(job_dirs.translated_dir),
        rendered_dir=str(job_dirs.rendered_dir),
        artifacts_dir=str(job_dirs.artifacts_dir),
        logs_dir=str(job_dirs.logs_dir),
        source_pdf=str(spec.inputs.source_pdf),
        translations_dir=str(spec.inputs.translations_dir),
        translation_manifest=str(spec.inputs.translation_manifest or ""),
        start_page=spec.params.start_page,
        end_page=spec.params.end_page,
        render_mode=spec.params.render_mode,
        compile_workers=spec.params.compile_workers,
        typst_font_family=spec.params.typst_font_family,
        pdf_compress_dpi=spec.params.pdf_compress_dpi,
        translated_pdf_name=spec.params.translated_pdf_name,
        api_key=resolve_credential_ref(spec.params.credential_ref),
        model=spec.params.model,
        base_url=spec.params.base_url,
        body_font_size_factor=spec.params.body_font_size_factor,
        body_leading_factor=spec.params.body_leading_factor,
        inner_bbox_shrink_x=spec.params.inner_bbox_shrink_x,
        inner_bbox_shrink_y=spec.params.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=spec.params.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=spec.params.inner_bbox_dense_shrink_y,
    )


def main() -> None:
    args = parse_args()
    spec = RenderStageSpec.load(Path(args.spec))
    stage_spec_schema_version = spec.schema_version
    args = _args_from_spec(spec)
    layout.apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )

    job_dirs = job_dirs_from_explicit_args(args)
    enable_job_log_capture(job_dirs.logs_dir, prefix="render-only")
    event_writer = PipelineEventWriter(
        job_id=spec.job.job_id,
        job_root=job_dirs.root,
        logs_dir=job_dirs.logs_dir,
        workflow=spec.job.workflow,
    )
    source_pdf_path = Path(args.source_pdf).resolve()
    translations_dir = Path(args.translations_dir).resolve()
    translation_manifest_path = (
        Path(args.translation_manifest).resolve()
        if args.translation_manifest.strip()
        else None
    )
    translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
    output_pdf_path = job_dirs.rendered_dir / translated_pdf_name
    summary_path = job_dirs.artifacts_dir / PIPELINE_SUMMARY_FILE_NAME

    with pipeline_event_writer_scope(event_writer):
        emit_stage_transition(
            stage="startup",
            message="render-only worker 已启动",
        )
        print(format_stdout_kv(STDOUT_LABEL_EVENTS_JSONL, event_writer.path))
        emit_stage_transition(
            stage="render_prepare",
            message="开始准备纯渲染阶段",
        )
        started = time.perf_counter()
        result = run_render_stage(
            source_pdf_path=source_pdf_path,
            translations_dir=translations_dir,
            translation_manifest_path=translation_manifest_path,
            output_pdf_path=output_pdf_path,
            start_page=args.start_page,
            end_page=args.end_page,
            render_mode=args.render_mode,
            compile_workers=args.compile_workers or None,
            extract_selected_pages=False,
            api_key=args.api_key,
            model=args.model,
            base_url=args.base_url,
            typst_font_family=args.typst_font_family,
            pdf_compress_dpi=args.pdf_compress_dpi,
        )
        elapsed = time.perf_counter() - started
        save_json(
            summary_path,
            {
                "job_root": str(job_dirs.root),
                "source_pdf": str(source_pdf_path),
                "translations_dir": str(translations_dir),
                "translation_manifest": str(translation_manifest_path or ""),
                "output_pdf": str(result["output_pdf_path"]),
                "pages_processed": result["pages_rendered"],
                "render_elapsed": elapsed,
                "total_elapsed": elapsed,
                "render_mode": args.render_mode,
                "effective_render_mode": result.get("effective_render_mode", args.render_mode),
                "pdf_compress_dpi": args.pdf_compress_dpi,
                "render_diagnostics": result.get("render_diagnostics", {}),
                "events_jsonl": str(event_writer.path),
                "invocation": build_stage_invocation_metadata(
                    stage="render",
                    stage_spec_schema_version=stage_spec_schema_version,
                ),
            },
        )
        emit_artifact_published(
            artifact_key="pipeline_events_jsonl",
            path=event_writer.path,
            stage="saving",
            message="统一事件流已写出",
        )
        emit_artifact_published(
            artifact_key="output_pdf",
            path=Path(result["output_pdf_path"]),
            stage="saving",
            message="render-only 输出 PDF 已发布",
        )
        emit_stage_transition(
            stage="finished",
            message="render-only 阶段完成",
        )

        print(format_stdout_kv(STDOUT_LABEL_JOB_ROOT, job_dirs.root))
        print(format_stdout_kv(STDOUT_LABEL_SOURCE_PDF, source_pdf_path))
        print(format_stdout_kv(STDOUT_LABEL_TRANSLATIONS_DIR, translations_dir))
        print(format_stdout_kv(STDOUT_LABEL_OUTPUT_PDF, result["output_pdf_path"]))
        print(format_stdout_kv(STDOUT_LABEL_SUMMARY, summary_path))
        print(f"pages processed: {result['pages_rendered']}")
        print(f"save time: {elapsed:.2f}s")
        print(f"total time: {elapsed:.2f}s")
        if result.get("effective_render_mode"):
            print(f"effective render mode: {result['effective_render_mode']}")


if __name__ == "__main__":
    main()
