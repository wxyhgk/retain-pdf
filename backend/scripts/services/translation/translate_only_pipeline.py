from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.shared.job_dirs import job_dirs_from_explicit_args
from foundation.shared.stage_specs import build_stage_invocation_metadata
from foundation.shared.stage_specs import resolve_credential_ref
from foundation.shared.stage_specs import TranslateStageSpec
from foundation.shared.tee_output import enable_job_log_capture
from runtime.pipeline.translation_stage import translate_book_pipeline
from services.document_schema import build_normalization_summary
from services.document_schema import build_validation_report_from_path
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.document_schema import load_normalization_report
from services.mineru.artifacts import save_json
from services.mineru.contracts import format_stdout_kv
from services.mineru.contracts import MINERU_PIPELINE_SUMMARY_FILE_NAME
from services.mineru.contracts import STDOUT_LABEL_JOB_ROOT
from services.mineru.contracts import STDOUT_LABEL_LAYOUT_JSON
from services.mineru.contracts import STDOUT_LABEL_NORMALIZATION_REPORT_JSON
from services.mineru.contracts import STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON
from services.mineru.contracts import STDOUT_LABEL_SOURCE_JSON_USED
from services.mineru.contracts import STDOUT_LABEL_SOURCE_PDF
from services.mineru.contracts import STDOUT_LABEL_SUMMARY
from services.mineru.contracts import STDOUT_LABEL_TRANSLATIONS_DIR
from services.translation.diagnostics import write_translation_diagnostics
from services.translation.llm import DEFAULT_BASE_URL
from services.translation.llm import get_api_key
from services.translation.llm import normalize_base_url
from services.translation.terms import parse_glossary_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Translate from normalized OCR document.v1.json and stop before rendering.",
    )
    parser.add_argument("--spec", type=str, required=True, help="Path to translate stage spec JSON.")
    return parser.parse_args()


def _args_from_spec(spec: TranslateStageSpec) -> SimpleNamespace:
    job_dirs = spec.job_dirs
    return SimpleNamespace(
        job_root=str(job_dirs.root),
        source_dir=str(job_dirs.source_dir),
        ocr_dir=str(job_dirs.ocr_dir),
        translated_dir=str(job_dirs.translated_dir),
        rendered_dir=str(job_dirs.rendered_dir),
        artifacts_dir=str(job_dirs.artifacts_dir),
        logs_dir=str(job_dirs.logs_dir),
        source_json=str(spec.inputs.source_json),
        source_pdf=str(spec.inputs.source_pdf),
        layout_json=str(spec.inputs.layout_json or ""),
        start_page=spec.params.start_page,
        end_page=spec.params.end_page,
        batch_size=spec.params.batch_size,
        workers=spec.params.workers,
        mode=spec.params.mode,
        math_mode=spec.params.math_mode,
        skip_title_translation=spec.params.skip_title_translation,
        classify_batch_size=spec.params.classify_batch_size,
        rule_profile_name=spec.params.rule_profile_name,
        custom_rules_text=spec.params.custom_rules_text,
        glossary_id=spec.params.glossary_id,
        glossary_name=spec.params.glossary_name,
        glossary_resource_entry_count=spec.params.glossary_resource_entry_count,
        glossary_inline_entry_count=spec.params.glossary_inline_entry_count,
        glossary_overridden_entry_count=spec.params.glossary_overridden_entry_count,
        glossary_json=parse_glossary_json_json(spec.params.glossary_entries),
        api_key=resolve_credential_ref(spec.params.credential_ref),
        model=spec.params.model,
        base_url=spec.params.base_url,
    )


def parse_glossary_json_json(entries: list[dict]) -> str:
    import json

    return json.dumps(entries, ensure_ascii=False)


def main() -> None:
    args = parse_args()
    spec = TranslateStageSpec.load(Path(args.spec))
    stage_spec_schema_version = spec.schema_version
    args = _args_from_spec(spec)
    job_dirs = job_dirs_from_explicit_args(args)
    enable_job_log_capture(job_dirs.logs_dir, prefix="translate-only")

    source_json_path = Path(args.source_json).resolve()
    source_pdf_path = Path(args.source_pdf).resolve()
    layout_json_path = Path(args.layout_json).resolve() if args.layout_json.strip() else source_json_path
    normalization_report_path = source_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)
    translations_dir = job_dirs.translated_dir
    summary_path = job_dirs.artifacts_dir / MINERU_PIPELINE_SUMMARY_FILE_NAME

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )
    started = time.perf_counter()
    result = translate_book_pipeline(
        source_json_path=source_json_path,
        output_dir=translations_dir,
        api_key=api_key,
        start_page=args.start_page,
        end_page=args.end_page,
        batch_size=args.batch_size,
        workers=args.workers,
        mode=args.mode,
        math_mode=args.math_mode,
        classify_batch_size=args.classify_batch_size,
        skip_title_translation=args.skip_title_translation,
        model=args.model,
        base_url=args.base_url,
        source_pdf_path=source_pdf_path,
        rule_profile_name=args.rule_profile_name,
        custom_rules_text=args.custom_rules_text,
        glossary_id=args.glossary_id,
        glossary_name=args.glossary_name,
        glossary_resource_entry_count=args.glossary_resource_entry_count,
        glossary_inline_entry_count=args.glossary_inline_entry_count,
        glossary_overridden_entry_count=args.glossary_overridden_entry_count,
        glossary_entries=parse_glossary_json(args.glossary_json),
        invocation=build_stage_invocation_metadata(
            stage="translate",
            stage_spec_schema_version=stage_spec_schema_version,
        ),
    )
    elapsed = time.perf_counter() - started
    diagnostics_path = job_dirs.artifacts_dir / "translation_diagnostics.json"
    diagnostics_summary = write_translation_diagnostics(
        diagnostics_path,
        result.get("translation_run_diagnostics"),
        glossary=result.get("glossary"),
        translated_pages_map=result.get("translated_pages_map"),
    )

    schema_validation = build_validation_report_from_path(source_json_path)
    normalization_report = load_normalization_report(normalization_report_path)
    normalization_summary = build_normalization_summary(normalization_report)
    save_json(
        summary_path,
        {
            "job_root": str(job_dirs.root),
            "source_pdf": str(source_pdf_path),
            "layout_json": str(layout_json_path),
            "normalized_document_json": str(source_json_path),
            "normalization_report_json": str(normalization_report_path),
            "normalization_report": normalization_report,
            "normalization_summary": normalization_summary,
            "source_json_used": str(source_json_path),
            "schema_validation": schema_validation,
            "translations_dir": str(result["output_dir"]),
            "pages_processed": result["page_count"],
            "translated_items_total": result["translated_items"],
            "rule_profile_name": result.get("rule_profile_name", ""),
            "glossary": result.get("glossary", {}),
            "translate_elapsed": elapsed,
            "total_elapsed": elapsed,
            "translation_diagnostics_path": str(diagnostics_path) if diagnostics_summary else "",
            "translation_provider_family": diagnostics_summary.get("provider_family", ""),
            "translation_peak_inflight_requests": diagnostics_summary.get("concurrency_observed", {}).get(
                "peak_inflight_all_llm_requests",
                0,
            ),
            "translation_timeout_attempts": diagnostics_summary.get("request_counts", {}).get(
                "timeout_attempts",
                0,
            ),
            "translation_retrying_items": diagnostics_summary.get("retry_summary", {}).get(
                "retrying_request_labels",
                0,
            ),
            "mode": args.mode,
            "math_mode": args.math_mode,
            "model": args.model,
            "base_url": args.base_url,
            "invocation": build_stage_invocation_metadata(
                stage="translate",
                stage_spec_schema_version=stage_spec_schema_version,
            ),
        },
    )

    print(format_stdout_kv(STDOUT_LABEL_JOB_ROOT, job_dirs.root))
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_PDF, source_pdf_path))
    print(format_stdout_kv(STDOUT_LABEL_LAYOUT_JSON, layout_json_path))
    print(format_stdout_kv(STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON, source_json_path))
    print(format_stdout_kv(STDOUT_LABEL_NORMALIZATION_REPORT_JSON, normalization_report_path))
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_JSON_USED, source_json_path))
    print(format_stdout_kv(STDOUT_LABEL_TRANSLATIONS_DIR, result["output_dir"]))
    print(format_stdout_kv(STDOUT_LABEL_SUMMARY, summary_path))
    if result.get("rule_profile_name"):
        print(f"rule profile: {result['rule_profile_name']}")
    if result.get("glossary", {}).get("enabled"):
        glossary = result["glossary"]
        print(
            "glossary: "
            f"name={glossary.get('glossary_name') or glossary.get('glossary_id') or '<inline>'} "
            f"entries={glossary.get('entry_count', 0)} "
            f"source_hits={glossary.get('source_hit_entry_count', 0)} "
            f"target_hits={glossary.get('target_hit_entry_count', 0)}"
        )
    print(f"pages processed: {result['page_count']}")
    print(f"translated items: {result['translated_items']}")
    print(f"translation time: {elapsed:.2f}s")
    print(f"total time: {elapsed:.2f}s")
    if diagnostics_summary:
        print(f"translation diagnostics: {diagnostics_path}")
        print(f"translation provider family: {diagnostics_summary.get('provider_family', '')}")


if __name__ == "__main__":
    main()
