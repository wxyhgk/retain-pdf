from __future__ import annotations

from pathlib import Path

from services.document_schema import build_normalization_summary
from services.document_schema import build_validation_report_from_path
from services.document_schema import load_normalization_report
from services.mineru.artifacts import save_json
from services.mineru.contracts import STDOUT_LABEL_JOB_ROOT
from services.mineru.contracts import STDOUT_LABEL_LAYOUT_JSON
from services.mineru.contracts import STDOUT_LABEL_NORMALIZATION_REPORT_JSON
from services.mineru.contracts import STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON
from services.mineru.contracts import STDOUT_LABEL_OUTPUT_PDF
from services.mineru.contracts import STDOUT_LABEL_SOURCE_JSON_USED
from services.mineru.contracts import STDOUT_LABEL_SOURCE_PDF
from services.mineru.contracts import STDOUT_LABEL_SUMMARY
from services.mineru.contracts import STDOUT_LABEL_TRANSLATIONS_DIR
from services.mineru.contracts import format_stdout_kv


def write_pipeline_summary(
    *,
    summary_path: Path,
    job_root: Path,
    source_pdf_path: Path,
    layout_json_path: Path,
    normalized_json_path: Path,
    normalization_report_path: Path,
    source_json_path: Path,
    result: dict,
    mode: str,
    model: str,
    base_url: str,
    render_mode: str,
    pdf_compress_dpi: int,
) -> None:
    schema_validation = build_validation_report_from_path(normalized_json_path)
    normalization_report = load_normalization_report(normalization_report_path)
    normalization_summary = build_normalization_summary(normalization_report)
    save_json(
        summary_path,
        {
            "job_root": str(job_root),
            "source_pdf": str(source_pdf_path),
            "layout_json": str(layout_json_path),
            "normalized_document_json": str(normalized_json_path),
            "normalization_report_json": str(normalization_report_path),
            "normalization_report": normalization_report,
            "normalization_summary": normalization_summary,
            "source_json_used": str(source_json_path),
            "schema_validation": schema_validation,
            "translations_dir": str(result["output_dir"]),
            "output_pdf": str(result["output_pdf_path"]),
            "pages_processed": result["pages_processed"],
            "translated_items_total": result["translated_items_total"],
            "rule_profile_name": result.get("rule_profile_name", ""),
            "glossary": result.get("glossary", {}),
            "translate_elapsed": result["translate_elapsed"],
            "save_elapsed": result["save_elapsed"],
            "total_elapsed": result["total_elapsed"],
            "translation_diagnostics_path": result.get("translation_diagnostics_path", ""),
            "translation_provider_family": result.get("translation_provider_family", ""),
            "translation_peak_inflight_requests": result.get("translation_peak_inflight_requests", 0),
            "translation_timeout_attempts": result.get("translation_timeout_attempts", 0),
            "translation_retrying_items": result.get("translation_retrying_items", 0),
            "mode": mode,
            "model": model,
            "base_url": base_url,
            "render_mode": render_mode,
            "effective_render_mode": result.get("effective_render_mode", render_mode),
            "pdf_compress_dpi": pdf_compress_dpi,
        },
    )


def print_pipeline_summary(
    *,
    job_root: Path,
    source_pdf_path: Path,
    layout_json_path: Path,
    normalized_json_path: Path,
    normalization_report_path: Path,
    source_json_path: Path,
    summary_path: Path,
    result: dict,
) -> None:
    schema_validation = build_validation_report_from_path(normalized_json_path)
    normalization_report = load_normalization_report(normalization_report_path)
    normalization_summary = build_normalization_summary(normalization_report)
    print(format_stdout_kv(STDOUT_LABEL_JOB_ROOT, job_root))
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_PDF, source_pdf_path))
    print(format_stdout_kv(STDOUT_LABEL_LAYOUT_JSON, layout_json_path))
    print(format_stdout_kv(STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON, normalized_json_path))
    print(format_stdout_kv(STDOUT_LABEL_NORMALIZATION_REPORT_JSON, normalization_report_path))
    print(
        "schema validation: "
        f"valid={schema_validation['valid']} "
        f"schema={schema_validation['schema']} "
        f"version={schema_validation['schema_version']} "
        f"pages={schema_validation['page_count']} "
        f"blocks={schema_validation['block_count']}"
    )
    if normalization_report:
        print(
            "normalization report: "
            f"provider={normalization_summary['provider']} "
            f"detected={normalization_summary['detected_provider']} "
            f"compat_pages={normalization_summary['compat_pages']} "
            f"compat_blocks={normalization_summary['compat_blocks']}"
        )
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_JSON_USED, source_json_path))
    print(format_stdout_kv(STDOUT_LABEL_TRANSLATIONS_DIR, result["output_dir"]))
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
    print(format_stdout_kv(STDOUT_LABEL_OUTPUT_PDF, result["output_pdf_path"]))
    print(format_stdout_kv(STDOUT_LABEL_SUMMARY, summary_path))
    print(f"pages processed: {result['pages_processed']}")
    print(f"translated items: {result['translated_items_total']}")
    print(f"translate+render time: {result['translate_elapsed']:.2f}s")
    print(f"save time: {result['save_elapsed']:.2f}s")
    print(f"total time: {result['total_elapsed']:.2f}s")
    if result.get("translation_diagnostics_path"):
        print(f"translation diagnostics: {result['translation_diagnostics_path']}")
    if result.get("translation_provider_family"):
        print(f"translation provider family: {result['translation_provider_family']}")
    if result.get("effective_render_mode"):
        print(f"effective render mode: {result['effective_render_mode']}")
