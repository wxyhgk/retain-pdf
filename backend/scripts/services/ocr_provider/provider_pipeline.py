from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import layout
from foundation.shared.job_dirs import job_dirs_from_explicit_args
from foundation.shared.stage_specs import ProviderStageSpec
from foundation.shared.stage_specs import build_stage_invocation_metadata
from foundation.shared.stage_specs import resolve_credential_ref
from foundation.shared.tee_output import enable_job_log_capture
from runtime.pipeline.book_pipeline import run_book_pipeline
from services.document_schema import adapt_path_to_document_v1_with_report
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.document_schema import validate_saved_document_path
from services.document_schema.provider_adapters.paddle.content_extract import build_lines as build_paddle_lines
from services.document_schema.provider_adapters.paddle.content_extract import tighten_text_bbox as tighten_paddle_text_bbox
from services.document_schema.reporting import build_normalization_summary
from services.document_schema.providers import PROVIDER_PADDLE
from services.mineru.job_flow import run_mineru_to_job_dir
from services.network.retry import RetainNetworkError
from services.network.retry import direct_session
from services.network.retry import request_with_retry
from services.ocr_provider.paddle_api import PADDLE_BASE_URL
from services.ocr_provider.paddle_api import build_optional_payload as build_paddle_optional_payload
from services.ocr_provider.paddle_api import download_jsonl_result
from services.ocr_provider.paddle_api import get_paddle_token
from services.ocr_provider.paddle_api import normalize_model_name as normalize_paddle_model_name
from services.ocr_provider.paddle_markdown import materialize_paddle_markdown_artifacts
from services.ocr_provider.paddle_normalize import save_normalized_document_for_paddle as _save_normalized_document_for_paddle
from services.ocr_provider.paddle_normalize import rescale_document_geometry_to_pdf
from services.ocr_provider.paddle_runner import run_paddle_to_job_dir as _run_paddle_to_job_dir
from services.ocr_provider.paddle_api import poll_until_done as poll_paddle_until_done
from services.ocr_provider.paddle_api import submit_local_file as submit_local_paddle_file
from services.ocr_provider.paddle_api import submit_remote_url as submit_remote_paddle_url
from services.pipeline_shared.contracts import PIPELINE_SUMMARY_FILE_NAME
from services.pipeline_shared.contracts import STDOUT_LABEL_EVENTS_JSONL
from services.pipeline_shared.events import emit_artifact_published
from services.pipeline_shared.events import emit_stage_progress
from services.pipeline_shared.events import emit_stage_transition
from services.pipeline_shared.events import PipelineEventWriter
from services.pipeline_shared.events import pipeline_event_writer_scope
from services.pipeline_shared.io import save_json
from services.pipeline_shared.summary import print_pipeline_summary
from services.pipeline_shared.summary import write_pipeline_summary
from services.translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from services.translation.llm.shared.provider_runtime import get_api_key
from services.translation.llm.shared.provider_runtime import normalize_base_url
from services.translation.terms import parse_glossary_json

_SOURCE_DOWNLOAD_SESSION = direct_session(pool_connections=4, pool_maxsize=4)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="End-to-end provider-backed pipeline: OCR provider -> normalize -> translate -> render.",
    )
    parser.add_argument("--spec", type=str, required=True, help="Path to provider stage spec JSON.")
    return parser.parse_args()


def _serialize_glossary_entries(entries: list[dict]) -> str:
    return json.dumps(entries, ensure_ascii=False)


def _args_from_spec(spec: ProviderStageSpec) -> SimpleNamespace:
    job_dirs = spec.job_dirs
    provider = str(spec.ocr.provider or "mineru").strip().lower()
    provider_token = resolve_credential_ref(spec.ocr.credential_ref)
    return SimpleNamespace(
        provider=provider,
        file_url=spec.source.file_url,
        file_path=str(spec.source.file_path or ""),
        mineru_token=provider_token if provider == "mineru" else "",
        paddle_token=provider_token if provider == "paddle" else "",
        model_version=spec.ocr.model_version,
        paddle_api_url=spec.ocr.paddle_api_url,
        paddle_model=spec.ocr.paddle_model,
        is_ocr=spec.ocr.is_ocr,
        disable_formula=spec.ocr.disable_formula,
        disable_table=spec.ocr.disable_table,
        language=spec.ocr.language,
        page_ranges=spec.ocr.page_ranges,
        data_id=spec.ocr.data_id,
        no_cache=spec.ocr.no_cache,
        cache_tolerance=spec.ocr.cache_tolerance,
        extra_formats=spec.ocr.extra_formats,
        poll_interval=spec.ocr.poll_interval,
        poll_timeout=spec.ocr.poll_timeout,
        job_root=str(job_dirs.root),
        source_dir=str(job_dirs.source_dir),
        ocr_dir=str(job_dirs.ocr_dir),
        translated_dir=str(job_dirs.translated_dir),
        rendered_dir=str(job_dirs.rendered_dir),
        artifacts_dir=str(job_dirs.artifacts_dir),
        logs_dir=str(job_dirs.logs_dir),
        start_page=spec.translation.start_page,
        end_page=spec.translation.end_page,
        batch_size=spec.translation.batch_size,
        workers=spec.translation.workers,
        mode=spec.translation.mode,
        math_mode=spec.translation.math_mode,
        skip_title_translation=spec.translation.skip_title_translation,
        classify_batch_size=spec.translation.classify_batch_size,
        rule_profile_name=spec.translation.rule_profile_name,
        custom_rules_text=spec.translation.custom_rules_text,
        glossary_id=spec.translation.glossary_id,
        glossary_name=spec.translation.glossary_name,
        glossary_resource_entry_count=spec.translation.glossary_resource_entry_count,
        glossary_inline_entry_count=spec.translation.glossary_inline_entry_count,
        glossary_overridden_entry_count=spec.translation.glossary_overridden_entry_count,
        glossary_json=_serialize_glossary_entries(spec.translation.glossary_entries),
        api_key=resolve_credential_ref(spec.translation.credential_ref),
        model=spec.translation.model,
        base_url=spec.translation.base_url,
        render_mode=spec.render.render_mode,
        compile_workers=spec.render.compile_workers,
        typst_font_family=spec.render.typst_font_family,
        pdf_compress_dpi=spec.render.pdf_compress_dpi,
        translated_pdf_name=spec.render.translated_pdf_name,
        body_font_size_factor=spec.render.body_font_size_factor,
        body_leading_factor=spec.render.body_leading_factor,
        inner_bbox_shrink_x=spec.render.inner_bbox_shrink_x,
        inner_bbox_shrink_y=spec.render.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=spec.render.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=spec.render.inner_bbox_dense_shrink_y,
        font_unify_mode=spec.render.font_unify_mode,
        source_cleanup_strategy=spec.render.source_cleanup_strategy,
    )


def _materialize_local_source(args: SimpleNamespace) -> None:
    raw_path = str(args.file_path or "").strip()
    if not raw_path:
        return
    source_path = Path(raw_path).resolve()
    if not source_path.exists():
        raise RuntimeError(f"file not found: {source_path}")
    source_dir = Path(args.source_dir).resolve()
    source_dir.mkdir(parents=True, exist_ok=True)
    target_path = source_dir / source_path.name
    if source_path != target_path:
        shutil.copy2(source_path, target_path)
        source_path = target_path
    args.file_path = str(source_path)


def _download_source_pdf(source_url: str, source_dir: Path) -> Path:
    source_dir.mkdir(parents=True, exist_ok=True)
    try:
        response = request_with_retry(
            _SOURCE_DOWNLOAD_SESSION,
            "get",
            source_url,
            timeout=300,
            attempts=3,
            backoff_seconds=0.5,
            label="Source PDF",
        )
    except RetainNetworkError as err:
        raise RuntimeError(f"download source PDF failed: {source_url}: {err}") from err
    file_name = Path(source_url.split("?", 1)[0]).name or "source.pdf"
    if not file_name.lower().endswith(".pdf"):
        file_name = f"{file_name}.pdf"
    target_path = source_dir / file_name
    target_path.write_bytes(response.content)
    return target_path


def save_normalized_document_for_paddle(
    *,
    provider_result_json_path: Path,
    source_pdf_path: Path,
    normalized_json_path: Path,
    normalized_report_json_path: Path,
    document_id: str,
    provider_version: str,
) -> None:
    _save_normalized_document_for_paddle(
        provider_result_json_path=provider_result_json_path,
        source_pdf_path=source_pdf_path,
        normalized_json_path=normalized_json_path,
        normalized_report_json_path=normalized_report_json_path,
        document_id=document_id,
        provider_version=provider_version,
        adapt_document=adapt_path_to_document_v1_with_report,
        validate_document=validate_saved_document_path,
        build_lines=build_paddle_lines,
        tighten_text_bbox=tighten_paddle_text_bbox,
        save_json_file=save_json,
    )


def run_paddle_to_job_dir(args: SimpleNamespace) -> tuple[Path, Path, Path, Path]:
    return _run_paddle_to_job_dir(
        args,
        download_source_pdf=_download_source_pdf,
        get_token=get_paddle_token,
        submit_remote=submit_remote_paddle_url,
        submit_local=submit_local_paddle_file,
        poll_until_complete=poll_paddle_until_done,
        download_jsonl=download_jsonl_result,
        materialize_markdown=materialize_paddle_markdown_artifacts,
        save_normalized_document=save_normalized_document_for_paddle,
        save_json_file=save_json,
        normalize_model=normalize_paddle_model_name,
        build_optional_request_payload=build_paddle_optional_payload,
    )


def main() -> None:
    parsed = parse_args()
    spec = ProviderStageSpec.load(Path(parsed.spec))
    stage_spec_schema_version = spec.schema_version
    args = _args_from_spec(spec)
    _materialize_local_source(args)
    job_dirs = job_dirs_from_explicit_args(args)
    enable_job_log_capture(job_dirs.logs_dir, prefix="provider-pipeline")
    provider = str(args.provider or "mineru").strip().lower()
    event_writer = PipelineEventWriter(
        job_id=spec.job.job_id,
        job_root=job_dirs.root,
        logs_dir=job_dirs.logs_dir,
        workflow=spec.job.workflow,
        provider=provider or str(args.provider or "").strip().lower(),
    )
    layout.apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
        font_unify_mode=args.font_unify_mode,
        source_cleanup_strategy=args.source_cleanup_strategy,
    )
    with pipeline_event_writer_scope(event_writer):
        emit_stage_transition(
            stage="startup",
            message="provider worker 已启动",
            provider=provider,
        )
        print(f"{STDOUT_LABEL_EVENTS_JSONL}: {event_writer.path}", flush=True)
        if provider == "mineru":
            emit_stage_transition(
                stage="ocr_processing",
                message="开始执行 MinerU OCR provider 流程",
                provider=provider,
            )
            job_dirs, source_pdf_path, layout_json_path, normalized_json_path = run_mineru_to_job_dir(args)
        elif provider == "paddle":
            emit_stage_transition(
                stage="ocr_processing",
                message="开始执行 Paddle OCR provider 流程",
                provider=provider,
            )
            _, source_pdf_path, layout_json_path, normalized_json_path = run_paddle_to_job_dir(args)
            job_dirs = job_dirs_from_explicit_args(args)
        else:
            raise RuntimeError(f"unsupported provider-backed workflow provider: {provider}")

        normalization_report_path = normalized_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)
        translation_source_json_path = normalized_json_path
        translations_dir = job_dirs.translated_dir
        translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
        output_pdf_path = job_dirs.rendered_dir / translated_pdf_name
        emit_stage_progress(
            stage="normalizing",
            message="OCR provider 已完成，标准化文档已就绪",
            provider=provider,
        )
        api_key = get_api_key(
            args.api_key,
            required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
        )
        emit_stage_transition(
            stage="translation_prepare",
            message="开始准备翻译和渲染阶段",
            provider=provider,
        )
        result = run_book_pipeline(
            source_json_path=translation_source_json_path,
            source_pdf_path=source_pdf_path,
            output_dir=translations_dir,
            output_pdf_path=output_pdf_path,
            api_key=api_key,
            start_page=args.start_page,
            end_page=args.end_page,
            batch_size=args.batch_size,
            workers=args.workers,
            model=args.model,
            base_url=args.base_url,
            mode=args.mode,
            math_mode=args.math_mode,
            classify_batch_size=args.classify_batch_size,
            skip_title_translation=args.skip_title_translation,
            render_mode=args.render_mode,
            rule_profile_name=args.rule_profile_name,
            custom_rules_text=args.custom_rules_text,
            glossary_id=args.glossary_id,
            glossary_name=args.glossary_name,
            glossary_resource_entry_count=args.glossary_resource_entry_count,
            glossary_inline_entry_count=args.glossary_inline_entry_count,
            glossary_overridden_entry_count=args.glossary_overridden_entry_count,
            glossary_entries=parse_glossary_json(args.glossary_json),
            compile_workers=args.compile_workers or None,
            typst_font_family=args.typst_font_family,
            pdf_compress_dpi=args.pdf_compress_dpi,
            source_cleanup_strategy=args.source_cleanup_strategy,
            invocation=build_stage_invocation_metadata(
                stage="provider",
                stage_spec_schema_version=stage_spec_schema_version,
            ),
        )
        summary_path = job_dirs.artifacts_dir / PIPELINE_SUMMARY_FILE_NAME
        write_pipeline_summary(
            summary_path=summary_path,
            job_root=job_dirs.root,
            source_pdf_path=source_pdf_path,
            layout_json_path=layout_json_path,
            normalized_json_path=normalized_json_path,
            normalization_report_path=normalization_report_path,
            source_json_path=translation_source_json_path,
            result=result,
            mode=args.mode,
            model=args.model,
            base_url=args.base_url,
            render_mode=args.render_mode,
            pdf_compress_dpi=args.pdf_compress_dpi,
            invocation=build_stage_invocation_metadata(
                stage="provider",
                stage_spec_schema_version=stage_spec_schema_version,
            ),
        )
        emit_artifact_published(
            artifact_key="pipeline_events_jsonl",
            path=event_writer.path,
            stage="saving",
            message="统一事件流已写出",
        )
        emit_stage_transition(
            stage="finished",
            message="provider-backed 全流程完成",
            provider=provider,
        )
        print_pipeline_summary(
            job_root=job_dirs.root,
            source_pdf_path=source_pdf_path,
            layout_json_path=layout_json_path,
            normalized_json_path=normalized_json_path,
            normalization_report_path=normalization_report_path,
            source_json_path=translation_source_json_path,
            summary_path=summary_path,
            result=result,
        )


if __name__ == "__main__":
    main()
