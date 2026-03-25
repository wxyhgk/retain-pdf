from __future__ import annotations

from pathlib import Path

from mineru.artifacts import save_json


def write_pipeline_summary(
    *,
    summary_path: Path,
    job_root: Path,
    source_pdf_path: Path,
    layout_json_path: Path,
    result: dict,
    mode: str,
    model: str,
    base_url: str,
    render_mode: str,
    pdf_compress_dpi: int,
) -> None:
    save_json(
        summary_path,
        {
            "job_root": str(job_root),
            "source_pdf": str(source_pdf_path),
            "layout_json": str(layout_json_path),
            "translations_dir": str(result["output_dir"]),
            "output_pdf": str(result["output_pdf_path"]),
            "pages_processed": result["pages_processed"],
            "translated_items_total": result["translated_items_total"],
            "rule_profile_name": result.get("rule_profile_name", ""),
            "translate_elapsed": result["translate_elapsed"],
            "save_elapsed": result["save_elapsed"],
            "total_elapsed": result["total_elapsed"],
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
    summary_path: Path,
    result: dict,
) -> None:
    print(f"job root: {job_root}")
    print(f"source pdf: {source_pdf_path}")
    print(f"layout json: {layout_json_path}")
    print(f"translations dir: {result['output_dir']}")
    if result.get("rule_profile_name"):
        print(f"rule profile: {result['rule_profile_name']}")
    print(f"output pdf: {result['output_pdf_path']}")
    print(f"summary: {summary_path}")
    print(f"pages processed: {result['pages_processed']}")
    print(f"translated items: {result['translated_items_total']}")
    print(f"translate+render time: {result['translate_elapsed']:.2f}s")
    print(f"save time: {result['save_elapsed']:.2f}s")
    print(f"total time: {result['total_elapsed']:.2f}s")
    if result.get("effective_render_mode"):
        print(f"effective render mode: {result['effective_render_mode']}")
