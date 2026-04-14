import argparse
import sys
from pathlib import Path
from types import SimpleNamespace
import json

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import layout
from foundation.shared.job_dirs import job_dirs_from_explicit_args
from foundation.shared.stage_specs import build_stage_invocation_metadata
from foundation.shared.stage_specs import MineruStageSpec
from foundation.shared.stage_specs import resolve_credential_ref
from foundation.shared.tee_output import enable_job_log_capture
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.mineru.artifacts import resolve_translation_source_json_path
from services.mineru.contracts import MINERU_PIPELINE_SUMMARY_FILE_NAME
from services.mineru.job_flow import run_mineru_to_job_dir
from services.mineru.summary import print_pipeline_summary
from services.mineru.summary import write_pipeline_summary
from runtime.pipeline.book_pipeline import run_book_pipeline
from services.translation.llm import DEFAULT_BASE_URL
from services.translation.llm import get_api_key
from services.translation.llm import normalize_base_url
from services.translation.terms import parse_glossary_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="End-to-end MinerU pipeline: parse PDF with MinerU, build document.v1.json, then translate and render.",
    )
    parser.add_argument("--spec", type=str, required=True, help="Path to mineru stage spec JSON.")
    return parser.parse_args()


def _serialize_glossary_entries(entries: list[dict]) -> str:
    return json.dumps(entries, ensure_ascii=False)


def _args_from_spec(spec: MineruStageSpec) -> SimpleNamespace:
    job_dirs = spec.job_dirs
    return SimpleNamespace(
        file_url=spec.source.file_url,
        file_path=str(spec.source.file_path or ""),
        mineru_token=resolve_credential_ref(spec.ocr.credential_ref),
        model_version=spec.ocr.model_version,
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
    )


def main() -> None:
    args = parse_args()
    spec = MineruStageSpec.load(Path(args.spec))
    stage_spec_schema_version = spec.schema_version
    args = _args_from_spec(spec)
    job_dirs = job_dirs_from_explicit_args(args)
    enable_job_log_capture(job_dirs.logs_dir, prefix="mineru-pipeline")
    layout.apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )

    job_dirs, source_pdf_path, layout_json_path, normalized_json_path = run_mineru_to_job_dir(args)
    normalization_report_path = normalized_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)
    # The runtime mainline should consume the normalized document.
    # The raw MinerU layout remains available only for adapter/debug use.
    translation_source_json_path = resolve_translation_source_json_path(
        layout_json_path=layout_json_path,
        normalized_json_path=normalized_json_path,
        allow_layout_fallback=False,
    )
    translations_dir = job_dirs.translated_dir
    translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
    output_pdf_path = job_dirs.rendered_dir / translated_pdf_name

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
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
        invocation=build_stage_invocation_metadata(
            stage="mineru",
            stage_spec_schema_version=stage_spec_schema_version,
        ),
    )

    summary_path = job_dirs.artifacts_dir / MINERU_PIPELINE_SUMMARY_FILE_NAME
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
            stage="mineru",
            stage_spec_schema_version=stage_spec_schema_version,
        ),
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
