from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.shared.job_dirs import add_explicit_job_dir_args
from foundation.shared.job_dirs import job_dirs_from_explicit_args
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
    add_explicit_job_dir_args(parser)
    parser.add_argument("--source-json", type=str, required=True, help="Path to normalized document.v1.json.")
    parser.add_argument("--source-pdf", type=str, required=True, help="Path to source PDF.")
    parser.add_argument("--layout-json", type=str, default="", help="Optional raw provider layout.json for summary/debug.")
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=-1)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--workers", type=int, default=100)
    parser.add_argument("--mode", type=str, default="sci", choices=["fast", "precise", "sci"])
    parser.add_argument("--skip-title-translation", action="store_true")
    parser.add_argument("--classify-batch-size", type=int, default=12)
    parser.add_argument("--rule-profile-name", type=str, default="general_sci")
    parser.add_argument("--custom-rules-text", type=str, default="")
    parser.add_argument("--glossary-id", type=str, default="")
    parser.add_argument("--glossary-name", type=str, default="")
    parser.add_argument("--glossary-resource-entry-count", type=int, default=0)
    parser.add_argument("--glossary-inline-entry-count", type=int, default=0)
    parser.add_argument("--glossary-overridden-entry-count", type=int, default=0)
    parser.add_argument("--glossary-json", type=str, default="", help="JSON array of glossary entries.")
    parser.add_argument("--api-key", type=str, default="")
    parser.add_argument("--model", type=str, default="Q3.5-turbo")
    parser.add_argument("--base-url", type=str, default="http://1.94.67.196:10001/v1")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
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
            "model": args.model,
            "base_url": args.base_url,
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
