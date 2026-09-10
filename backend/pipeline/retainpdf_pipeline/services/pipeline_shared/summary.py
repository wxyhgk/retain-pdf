from __future__ import annotations

from pathlib import Path

# Import submodules (not package __init__) to avoid circular import with
# document_schema adapters that may load pipeline_shared.io.
from retainpdf_pipeline.ocr.document_schema.reporting import build_normalization_summary
from retainpdf_pipeline.ocr.document_schema.reporting import load_normalization_report
from retainpdf_pipeline.ocr.document_schema.validator import build_validation_report_from_path

from .contracts import STDOUT_LABEL_JOB_ROOT
from .contracts import STDOUT_LABEL_LAYOUT_JSON
from .contracts import STDOUT_LABEL_NORMALIZATION_REPORT_JSON
from .contracts import STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON
from .contracts import STDOUT_LABEL_EVENTS_JSONL
from .contracts import STDOUT_LABEL_OUTPUT_PDF
from .contracts import STDOUT_LABEL_SOURCE_JSON_USED
from .contracts import STDOUT_LABEL_SOURCE_PDF
from .contracts import STDOUT_LABEL_SUMMARY
from .contracts import STDOUT_LABEL_TRANSLATIONS_DIR
from .events import emit_artifact_published
from .events import get_active_pipeline_event_writer
from .contracts import format_stdout_kv
from .io import save_json


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
    invocation: dict | None = None,
) -> None:
    event_writer = get_active_pipeline_event_writer()
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
            "events_jsonl": str(event_writer.path) if event_writer is not None else "",
            "invocation": invocation or {},
        },
    )
    emit_artifact_published(
        artifact_key="pipeline_summary_json",
        path=summary_path,
        stage="saving",
        message="已写出 pipeline summary",
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
    event_writer = get_active_pipeline_event_writer()
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
            f"pages_observed={normalization_summary['pages_observed']} "
            f"blocks_observed={normalization_summary['blocks_observed']} "
            f"defaulted_document_fields={normalization_summary['defaulted_document_fields']} "
            f"defaulted_page_fields={normalization_summary['defaulted_page_fields']} "
            f"defaulted_block_fields={normalization_summary['defaulted_block_fields']}"
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
    if event_writer is not None:
        print(format_stdout_kv(STDOUT_LABEL_EVENTS_JSONL, event_writer.path))
    emit_artifact_published(
        artifact_key="source_pdf",
        path=source_pdf_path,
        stage="saving",
        message="源 PDF 已登记",
    )
    emit_artifact_published(
        artifact_key="layout_json",
        path=layout_json_path,
        stage="saving",
        message="layout json 已发布",
    )
    emit_artifact_published(
        artifact_key="normalized_document_json",
        path=normalized_json_path,
        stage="saving",
        message="标准化文档已发布",
    )
    emit_artifact_published(
        artifact_key="source_json_used",
        path=source_json_path,
        stage="saving",
        message="翻译输入文档已登记",
    )
    emit_artifact_published(
        artifact_key="translations_dir",
        path=Path(result["output_dir"]),
        stage="saving",
        message="翻译目录已发布",
    )
    emit_artifact_published(
        artifact_key="output_pdf",
        path=Path(result["output_pdf_path"]),
        stage="saving",
        message="最终 PDF 已发布",
    )
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
