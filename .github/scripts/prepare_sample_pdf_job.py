from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
from urllib.parse import urlparse
from urllib.request import Request
from urllib.request import urlopen


REPO_ROOT = Path(__file__).resolve().parents[2]
from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.foundation.config import runtime
from retainpdf_pipeline.foundation.shared.job_dirs import create_job_dirs


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_MINERU_MODEL_VERSION = "vlm"
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "data" / "github-actions"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare a GitHub Actions sample PDF translation job and emit a stage spec.",
    )
    parser.add_argument(
        "--mode",
        choices=["book", "mineru"],
        required=True,
        help="book = source PDF + normalized document.v1.json; mineru = source PDF only.",
    )
    parser.add_argument(
        "--source-pdf",
        required=True,
        help="HTTP(S) URL or repo-relative/local path to the source PDF.",
    )
    parser.add_argument(
        "--source-json",
        default="",
        help="For book mode: HTTP(S) URL or repo-relative/local path to document.v1.json.",
    )
    parser.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help="Structured output root for the generated job.",
    )
    parser.add_argument(
        "--job-id",
        default="",
        help="Optional explicit job id. Defaults to a timestamped id.",
    )
    parser.add_argument("--metadata-path", required=True, help="Where to write metadata JSON.")
    parser.add_argument("--spec-path", default="", help="Optional explicit spec JSON path.")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--translation-mode", default="sci", choices=["fast", "precise", "sci"])
    parser.add_argument("--math-mode", default="direct_typst")
    parser.add_argument("--render-mode", default="typst")
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=-1)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--classify-batch-size", type=int, default=12)
    parser.add_argument("--rule-profile-name", default="general_sci")
    parser.add_argument("--custom-rules-text", default="")
    parser.add_argument("--translated-pdf-name", default="")
    parser.add_argument("--skip-title-translation", action="store_true")
    parser.add_argument("--compile-workers", type=int, default=0)
    parser.add_argument("--pdf-compress-dpi", type=int, default=runtime.DEFAULT_PDF_COMPRESS_DPI)
    parser.add_argument("--typst-font-family", default=fonts.TYPST_DEFAULT_FONT_FAMILY)
    parser.add_argument("--body-font-size-factor", type=float, default=layout.BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=layout.BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=layout.INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=layout.INNER_BBOX_SHRINK_Y)
    parser.add_argument(
        "--inner-bbox-dense-shrink-x",
        type=float,
        default=layout.INNER_BBOX_DENSE_SHRINK_X,
    )
    parser.add_argument(
        "--inner-bbox-dense-shrink-y",
        type=float,
        default=layout.INNER_BBOX_DENSE_SHRINK_Y,
    )
    parser.add_argument("--mineru-model-version", default=DEFAULT_MINERU_MODEL_VERSION)
    parser.add_argument("--mineru-is-ocr", action="store_true")
    parser.add_argument("--mineru-disable-formula", action="store_true")
    parser.add_argument("--mineru-disable-table", action="store_true")
    parser.add_argument("--mineru-language", default="ch")
    parser.add_argument("--mineru-page-ranges", default="")
    parser.add_argument("--mineru-data-id", default="")
    parser.add_argument("--mineru-no-cache", action="store_true")
    parser.add_argument("--mineru-cache-tolerance", type=int, default=900)
    parser.add_argument("--mineru-extra-formats", default="")
    parser.add_argument("--mineru-poll-interval", type=int, default=5)
    parser.add_argument("--mineru-poll-timeout", type=int, default=1800)
    return parser.parse_args()


def _looks_like_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"}


def _sanitize_name(raw_name: str, fallback: str) -> str:
    cleaned = Path(raw_name).name.strip()
    if not cleaned:
        cleaned = fallback
    safe = "".join(ch if ch.isalnum() or ch in {"-", "_", ".", " "} else "_" for ch in cleaned)
    safe = safe.strip(" .")
    return safe or fallback


def _infer_name_from_url(url: str, fallback: str) -> str:
    path_name = Path(urlparse(url).path).name
    return _sanitize_name(path_name, fallback)


def _download_to(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": "retain-pdf-github-actions"})
    with urlopen(request, timeout=120) as response:
        with destination.open("wb") as handle:
            shutil.copyfileobj(response, handle)
    return destination.resolve()


def _resolve_local_path(raw_value: str) -> Path:
    path = Path(raw_value).expanduser()
    if not path.is_absolute():
        path = (REPO_ROOT / path).resolve()
    else:
        path = path.resolve()
    if not path.exists():
        raise RuntimeError(f"input file not found: {path}")
    return path


def _materialize_input(raw_value: str, destination_dir: Path, fallback_name: str) -> tuple[Path, str]:
    if _looks_like_url(raw_value):
        file_name = _infer_name_from_url(raw_value, fallback_name)
        resolved = _download_to(raw_value, destination_dir / file_name)
        return resolved, "url"
    resolved = _resolve_local_path(raw_value)
    if resolved.parent != destination_dir:
        copied = destination_dir / _sanitize_name(resolved.name, fallback_name)
        copied.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(resolved, copied)
        resolved = copied.resolve()
    return resolved, "path"


def _default_translated_pdf_name(source_pdf_path: Path) -> str:
    stem = source_pdf_path.stem.strip() or "translated"
    return f"{stem}-translated.pdf"


def _build_job_id(explicit: str) -> str:
    if explicit.strip():
        return explicit.strip()
    return datetime.now().strftime("%Y%m%d%H%M%S") + "-gha"


def _write_json(path: Path, payload: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path.resolve()


def _book_stage_spec(args: argparse.Namespace, job_root: Path, source_pdf_path: Path, source_json_path: Path) -> dict:
    translated_pdf_name = args.translated_pdf_name.strip() or _default_translated_pdf_name(source_pdf_path)
    return {
        "schema_version": "book.stage.v1",
        "stage": "book",
        "job": {
            "job_id": job_root.name,
            "job_root": str(job_root),
            "workflow": "github_actions_book",
        },
        "inputs": {
            "source_json": str(source_json_path),
            "source_pdf": str(source_pdf_path),
            "layout_json": str(source_json_path),
        },
        "translation": {
            "start_page": args.start_page,
            "end_page": args.end_page,
            "batch_size": args.batch_size,
            "workers": args.workers,
            "mode": args.translation_mode,
            "math_mode": args.math_mode,
            "skip_title_translation": args.skip_title_translation,
            "classify_batch_size": args.classify_batch_size,
            "rule_profile_name": args.rule_profile_name,
            "custom_rules_text": args.custom_rules_text,
            "glossary_id": "",
            "glossary_name": "",
            "glossary_resource_entry_count": 0,
            "glossary_inline_entry_count": 0,
            "glossary_overridden_entry_count": 0,
            "glossary_entries": [],
            "model": args.model,
            "base_url": args.base_url,
            "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
        },
        "render": {
            "render_mode": args.render_mode,
            "compile_workers": args.compile_workers,
            "typst_font_family": args.typst_font_family,
            "pdf_compress_dpi": args.pdf_compress_dpi,
            "translated_pdf_name": translated_pdf_name,
            "body_font_size_factor": args.body_font_size_factor,
            "body_leading_factor": args.body_leading_factor,
            "inner_bbox_shrink_x": args.inner_bbox_shrink_x,
            "inner_bbox_shrink_y": args.inner_bbox_shrink_y,
            "inner_bbox_dense_shrink_x": args.inner_bbox_dense_shrink_x,
            "inner_bbox_dense_shrink_y": args.inner_bbox_dense_shrink_y,
        },
    }


def _mineru_stage_spec(args: argparse.Namespace, job_root: Path, source_pdf_path: Path) -> dict:
    translated_pdf_name = args.translated_pdf_name.strip() or _default_translated_pdf_name(source_pdf_path)
    return {
        "schema_version": "mineru.stage.v1",
        "stage": "mineru",
        "job": {
            "job_id": job_root.name,
            "job_root": str(job_root),
            "workflow": "github_actions_mineru",
        },
        "source": {
            "file_url": "",
            "file_path": str(source_pdf_path),
        },
        "ocr": {
            "credential_ref": "env:MINERU_API_TOKEN",
            "model_version": args.mineru_model_version,
            "is_ocr": args.mineru_is_ocr,
            "disable_formula": args.mineru_disable_formula,
            "disable_table": args.mineru_disable_table,
            "language": args.mineru_language,
            "page_ranges": args.mineru_page_ranges,
            "data_id": args.mineru_data_id,
            "no_cache": args.mineru_no_cache,
            "cache_tolerance": args.mineru_cache_tolerance,
            "extra_formats": args.mineru_extra_formats,
            "poll_interval": args.mineru_poll_interval,
            "poll_timeout": args.mineru_poll_timeout,
        },
        "translation": {
            "start_page": args.start_page,
            "end_page": args.end_page,
            "batch_size": args.batch_size,
            "workers": args.workers,
            "mode": args.translation_mode,
            "math_mode": args.math_mode,
            "skip_title_translation": args.skip_title_translation,
            "classify_batch_size": args.classify_batch_size,
            "rule_profile_name": args.rule_profile_name,
            "custom_rules_text": args.custom_rules_text,
            "glossary_id": "",
            "glossary_name": "",
            "glossary_resource_entry_count": 0,
            "glossary_inline_entry_count": 0,
            "glossary_overridden_entry_count": 0,
            "glossary_entries": [],
            "model": args.model,
            "base_url": args.base_url,
            "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
        },
        "render": {
            "render_mode": args.render_mode,
            "compile_workers": args.compile_workers,
            "typst_font_family": args.typst_font_family,
            "pdf_compress_dpi": args.pdf_compress_dpi,
            "translated_pdf_name": translated_pdf_name,
            "body_font_size_factor": args.body_font_size_factor,
            "body_leading_factor": args.body_leading_factor,
            "inner_bbox_shrink_x": args.inner_bbox_shrink_x,
            "inner_bbox_shrink_y": args.inner_bbox_shrink_y,
            "inner_bbox_dense_shrink_x": args.inner_bbox_dense_shrink_x,
            "inner_bbox_dense_shrink_y": args.inner_bbox_dense_shrink_y,
        },
    }


def main() -> int:
    args = parse_args()
    job_dirs = create_job_dirs(Path(args.output_root).resolve(), _build_job_id(args.job_id))
    source_pdf_path, source_pdf_origin = _materialize_input(
        args.source_pdf,
        job_dirs.source_dir,
        "source.pdf",
    )
    source_json_path: Path | None = None
    source_json_origin = ""
    if args.mode == "book":
        if not args.source_json.strip():
            raise RuntimeError("--source-json is required when --mode=book")
        source_json_path, source_json_origin = _materialize_input(
            args.source_json,
            job_dirs.ocr_dir,
            "document.v1.json",
        )

    spec_payload = (
        _book_stage_spec(args, job_dirs.root, source_pdf_path, source_json_path)
        if args.mode == "book"
        else _mineru_stage_spec(args, job_dirs.root, source_pdf_path)
    )
    spec_path = Path(args.spec_path).expanduser() if args.spec_path.strip() else job_dirs.artifacts_dir / "sample-translate.spec.json"
    if not spec_path.is_absolute():
        spec_path = (REPO_ROOT / spec_path).resolve()
    spec_path = _write_json(spec_path, spec_payload)

    translated_pdf_name = spec_payload["render"]["translated_pdf_name"]
    metadata = {
        "mode": args.mode,
        "job_id": job_dirs.root.name,
        "job_root": str(job_dirs.root),
        "spec_path": str(spec_path),
        "source_pdf_path": str(source_pdf_path),
        "source_pdf_origin": source_pdf_origin,
        "source_json_path": str(source_json_path) if source_json_path else "",
        "source_json_origin": source_json_origin,
        "translated_pdf_name": translated_pdf_name,
        "expected_output_pdf": str((job_dirs.rendered_dir / translated_pdf_name).resolve()),
        "job_dirs": {
            "source_dir": str(job_dirs.source_dir),
            "ocr_dir": str(job_dirs.ocr_dir),
            "translated_dir": str(job_dirs.translated_dir),
            "rendered_dir": str(job_dirs.rendered_dir),
            "artifacts_dir": str(job_dirs.artifacts_dir),
            "logs_dir": str(job_dirs.logs_dir),
        },
        "translation": {
            "mode": args.translation_mode,
            "math_mode": args.math_mode,
            "model": args.model,
            "base_url": args.base_url,
        },
        "render": {
            "render_mode": args.render_mode,
            "pdf_compress_dpi": args.pdf_compress_dpi,
            "typst_font_family": args.typst_font_family,
        },
    }
    metadata_path = Path(args.metadata_path).expanduser()
    if not metadata_path.is_absolute():
        metadata_path = (REPO_ROOT / metadata_path).resolve()
    _write_json(metadata_path, metadata)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
