#!/usr/bin/env python3
"""Backfill derived document artifacts from already-downloaded job inputs.

This command is deliberately offline: it reuses the normalize and Markdown
fallback entrypoints, validates the on-demand Reader inputs, and refreshes the
derived SQLite FTS rows. It never invokes an OCR provider or an LLM.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import time
from typing import Any, Iterable


PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))


from retainpdf_pipeline.foundation.shared.stage_specs import NormalizeStageSpec
from retainpdf_pipeline.ocr.document_schema.markdown_fallback import materialize_document_markdown_fallback
from retainpdf_pipeline.ocr.document_schema.markdown_fallback import render_document_markdown
from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import build_normalized_artifacts
from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import normalized_artifact_paths
from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import write_normalized_artifacts
from retainpdf_pipeline.ocr.document_schema.reporting import build_normalization_summary
from retainpdf_pipeline.services.pipeline_shared.io import save_json_atomic
from retainpdf_pipeline.ocr.ocr_provider.paddle_runner import apply_cli_normalization_report_semantics
from retainpdf_pipeline.translate.public import load_translation_manifest


_URL_RE = re.compile(r"https?://[^\s\"']+", re.IGNORECASE)
_SECRET_RE = re.compile(
    r"(?i)(authorization|api[-_]?key|access[-_]?token|secret|password)\s*[:=]\s*[^\s,;]+"
)


def main() -> None:
    args = _parse_args()
    jobs_root = Path(args.jobs_root).resolve()
    db_path = Path(args.db_path).resolve() if args.db_path else jobs_root.parent / "db" / "jobs.db"
    report_path = _validated_report_path(args.report, jobs_root=jobs_root, db_path=db_path)
    started = time.perf_counter()
    results: list[dict[str, Any]] = []

    try:
        job_dirs = _iter_job_dirs(jobs_root, args.job_id)
    except ValueError as exc:
        raise SystemExit(str(exc)) from None

    for index, job_dir in enumerate(job_dirs):
        if args.limit > 0 and index >= args.limit:
            break
        result = _process_job(
            job_dir,
            write=args.write,
            require_complete=args.require_complete,
            db_path=db_path,
            refresh_fts=not args.skip_fts,
            explicit=bool(args.job_id),
            include_non_succeeded=args.include_non_succeeded,
        )
        results.append(result)
        if args.verbose or result["status"] in {"failed", "incomplete"}:
            print(json.dumps(result, ensure_ascii=False), flush=True)
        if args.fail_fast and result["status"] in {"failed", "incomplete"}:
            break

    counts: dict[str, int] = {}
    for result in results:
        status = str(result["status"])
        counts[status] = counts.get(status, 0) + 1
    summary = {
        "mode": "write" if args.write else "dry-run",
        "jobs_root": str(jobs_root),
        "db_path": str(db_path),
        "counts": counts,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "results": results,
    }
    if report_path is not None:
        save_json_atomic(report_path, summary)
    print(
        json.dumps({key: value for key, value in summary.items() if key != "results"}, ensure_ascii=False),
        flush=True,
    )
    if counts.get("failed", 0) or counts.get("incomplete", 0):
        raise SystemExit(1)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Rebuild document.v1, missing Markdown fallback, Reader input checks, "
            "and active-document FTS from existing job artifacts."
        ),
    )
    parser.add_argument("--jobs-root", default="data/jobs", help="Root containing job folders.")
    parser.add_argument("--job-id", action="append", default=[], help="Process only this job id; repeatable.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum jobs to inspect; 0 means all.")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Atomically write changed artifacts and FTS. The default is dry-run.",
    )
    parser.add_argument(
        "--require-complete",
        action="store_true",
        help="Reject documents with completeness warnings instead of reporting them.",
    )
    parser.add_argument(
        "--db-path",
        default="",
        help="jobs.db path; defaults to <jobs-root>/../db/jobs.db.",
    )
    parser.add_argument(
        "--skip-fts",
        action="store_true",
        help="Do not inspect or refresh FTS for active documents.",
    )
    parser.add_argument(
        "--include-non-succeeded",
        action="store_true",
        help="Explicitly include failed/running/orphan jobs; default batch scope is succeeded or active jobs.",
    )
    parser.add_argument("--report", default="", help="Optional JSON summary path.")
    parser.add_argument("--verbose", action="store_true", help="Print one sanitized JSON result per job.")
    parser.add_argument("--fail-fast", action="store_true", help="Stop after the first failure.")
    return parser.parse_args()


def _iter_job_dirs(jobs_root: Path, job_ids: list[str]) -> list[Path]:
    if job_ids:
        selected: list[Path] = []
        seen: set[str] = set()
        for raw_job_id in job_ids:
            job_id = str(raw_job_id or "").strip()
            if (
                not job_id
                or job_id in {".", ".."}
                or Path(job_id).name != job_id
                or "/" in job_id
                or "\\" in job_id
            ):
                raise ValueError(f"invalid job id: {job_id!r}")
            if job_id not in seen:
                selected.append(jobs_root / job_id)
                seen.add(job_id)
        return selected
    if not jobs_root.exists():
        return []
    return sorted(path for path in jobs_root.iterdir() if path.is_dir())


def _process_job(
    job_dir: Path,
    *,
    write: bool,
    require_complete: bool,
    db_path: Path,
    refresh_fts: bool,
    explicit: bool = False,
    include_non_succeeded: bool = False,
) -> dict[str, Any]:
    started = time.perf_counter()
    base: dict[str, Any] = {
        "job_id": job_dir.name,
        "status": "failed",
        "changed": False,
        "written": False,
        "error": "",
    }
    spec_path = job_dir / "specs" / "normalize.spec.json"
    if not job_dir.is_dir():
        return _finish(
            base,
            started,
            status="failed" if explicit else "skipped",
            error="job directory not found",
        )
    if not spec_path.exists():
        return _finish(
            base,
            started,
            status="failed" if explicit else "skipped",
            error="normalize stage spec not found",
        )
    try:
        eligibility = _job_backfill_eligibility(
            db_path=db_path,
            job_id=job_dir.name,
            include_non_succeeded=include_non_succeeded,
            write=write,
        )
        base["eligibility"] = eligibility
        if not eligibility["eligible"]:
            return _finish(
                base,
                started,
                status="skipped",
                error=str(eligibility.get("reason", "job is not eligible")),
            )

        spec = NormalizeStageSpec.load(spec_path)
        if spec.job.job_root != job_dir.resolve():
            raise RuntimeError("normalize spec job_root does not match selected job")
        if spec.job.job_id not in {job_dir.name, f"{job_dir.name}-ocr"}:
            raise RuntimeError("normalize spec job_id does not match selected job")

        base["data_info_completeness"] = _inspect_paddle_data_info_completeness(spec)

        document, report = build_normalized_artifacts(spec)
        report = _preserve_official_cli_report_semantics(spec, report)
        validation = report.get("validation", {}) or {}
        normalization = build_normalization_summary(report)
        base.update(
            {
                "provider": spec.inputs.provider,
                "schema_version": str(document.get("schema_version", "")),
                "page_count": int(validation.get("page_count", 0) or 0),
                "block_count": int(validation.get("block_count", 0) or 0),
                "asset_count": int(validation.get("asset_count", 0) or 0),
                "referenced_asset_count": int(validation.get("referenced_asset_count", 0) or 0),
                "unreferenced_asset_count": int(validation.get("unreferenced_asset_count", 0) or 0),
                "provider_markdown_image_count": int(
                    validation.get("provider_markdown_image_count", 0) or 0
                ),
                "covered_provider_markdown_image_count": int(
                    validation.get("covered_provider_markdown_image_count", 0) or 0
                ),
                "uncovered_provider_markdown_image_count": int(
                    validation.get("uncovered_provider_markdown_image_count", 0) or 0
                ),
                "asset_block_count": int(validation.get("asset_block_count", 0) or 0),
                "linked_asset_block_count": int(validation.get("linked_asset_block_count", 0) or 0),
                "zero_segment_bbox_count": int(validation.get("zero_segment_bbox_count", 0) or 0),
                "approximate_segment_bbox_count": int(
                    validation.get("approximate_segment_bbox_count", 0) or 0
                ),
                "provider_segment_bbox_count": int(
                    validation.get("provider_segment_bbox_count", 0) or 0
                ),
                "formula_segment_count": int(validation.get("formula_segment_count", 0) or 0),
                "provider_formula_segment_bbox_count": int(
                    validation.get("provider_formula_segment_bbox_count", 0) or 0
                ),
                "approximate_formula_segment_bbox_count": int(
                    validation.get("approximate_formula_segment_bbox_count", 0) or 0
                ),
                "line_bbox_precision_counts": dict(
                    validation.get("line_bbox_precision_counts", {}) or {}
                ),
                "complete": bool(validation.get("complete", False)),
                "warning_count": len(normalization.get("warnings", []) or []),
            }
        )
        if require_complete and not validation.get("complete", False):
            return _finish(base, started, status="incomplete", error="completeness warnings present")

        normalized_path, report_path = normalized_artifact_paths(spec)
        document_changed = _path_sha256(normalized_path) != _payload_sha256(document, compact=True)
        report_changed = _path_sha256(report_path) != _payload_sha256(report, compact=False)
        base["document"] = {
            "status": "would_update" if (document_changed or report_changed) else "unchanged",
            "document_changed": document_changed,
            "report_changed": report_changed,
            "document_path": str(normalized_path),
            "report_path": str(report_path),
        }

        markdown = _backfill_markdown(
            job_dir=job_dir,
            normalized_path=normalized_path,
            document=document,
            write=False,
        )
        manifest, translation_paths = _inspect_translation_manifest(job_dir)
        reader = _inspect_reader_derivatives(
            source_pdf=spec.inputs.source_pdf,
            document=document,
            translation_paths=translation_paths,
            manifest_status=str(manifest["status"]),
        )
        base["markdown"] = markdown
        base["translation_manifest"] = manifest
        base["reader"] = reader

        unsafe_reason = _unsafe_reason(manifest)
        if write and unsafe_reason:
            base["fts"] = {"status": "blocked_by_manifest", "row_count": 0}
            base["changed"] = document_changed or report_changed or markdown["status"] == "would_create"
            return _finish(base, started, status="incomplete", error=unsafe_reason)

        fts = (
            _sync_active_document_fts(
                db_path=db_path,
                job_dir=job_dir,
                document=document,
                write=False,
            )
            if refresh_fts
            else {"status": "skipped", "row_count": 0}
        )
        base["fts"] = fts

        would_change = (
            document_changed
            or report_changed
            or markdown["status"] == "would_create"
            or fts["status"] == "would_refresh"
        )
        if not write:
            base["changed"] = would_change
            return _finish(
                base,
                started,
                status="incomplete" if unsafe_reason else ("would_update" if would_change else "unchanged"),
                error=unsafe_reason,
            )

        if document_changed or report_changed:
            _write_normalized_artifacts_with_rollback(spec, document, report)
            base["document"]["status"] = "updated"
            base["written"] = True

        if markdown["status"] == "would_create":
            markdown = _backfill_markdown(
                job_dir=job_dir,
                normalized_path=normalized_path,
                document=document,
                write=True,
            )
            base["markdown"] = markdown
            base["written"] = base["written"] or markdown["status"] == "created"

        if refresh_fts:
            fts = _sync_active_document_fts(
                db_path=db_path,
                job_dir=job_dir,
                document=document,
                write=True,
            )
            base["fts"] = fts
            base["written"] = base["written"] or fts["status"] == "refreshed"

        changed = bool(base["written"])
        base["changed"] = changed
        return _finish(
            base,
            started,
            status="incomplete" if unsafe_reason else ("updated" if changed else "unchanged"),
            error=unsafe_reason,
        )
    except Exception as exc:
        return _finish(base, started, status="failed", error=_safe_error(exc))


def _finish(
    result: dict[str, Any],
    started: float,
    *,
    status: str,
    error: str = "",
) -> dict[str, Any]:
    result["status"] = status
    result["error"] = _redact_text(error)
    result["elapsed_seconds"] = round(time.perf_counter() - started, 3)
    return result


def _job_backfill_eligibility(
    *,
    db_path: Path,
    job_id: str,
    include_non_succeeded: bool,
    write: bool,
) -> dict[str, Any]:
    if include_non_succeeded:
        return {"eligible": True, "status": "explicit_non_succeeded_opt_in"}
    if not db_path.exists():
        if write:
            return {
                "eligible": False,
                "status": "database_missing",
                "reason": "database-less writes require --include-non-succeeded",
            }
        return {"eligible": True, "status": "database_missing_dry_run"}
    with sqlite3.connect(db_path, timeout=5.0) as connection:
        if not _table_exists(connection, "jobs"):
            raise RuntimeError("jobs database is missing jobs schema")
        row = connection.execute(
            "SELECT status_json FROM jobs WHERE job_id = ?1",
            (job_id,),
        ).fetchone()
        active = False
        if _table_exists(connection, "documents"):
            active = (
                connection.execute(
                    "SELECT 1 FROM documents WHERE active_job_id = ?1 LIMIT 1",
                    (job_id,),
                ).fetchone()
                is not None
            )
    status = _decode_job_status(row[0]) if row is not None else "unregistered"
    if status == "succeeded":
        return {"eligible": True, "status": status, "active": active}
    return {
        "eligible": False,
        "status": status,
        "active": active,
        "reason": f"job status {status!r} requires --include-non-succeeded",
    }


def _validated_report_path(raw_path: str, *, jobs_root: Path, db_path: Path) -> Path | None:
    if not str(raw_path or "").strip():
        return None
    report_path = Path(raw_path).resolve()
    try:
        report_path.relative_to(jobs_root)
    except ValueError:
        pass
    else:
        raise SystemExit("--report must be outside --jobs-root to protect provider/job artifacts")
    if report_path == db_path:
        raise SystemExit("--report must not overwrite the jobs database")
    return report_path


def _decode_job_status(raw: Any) -> str:
    text = str(raw or "").strip()
    try:
        decoded = json.loads(text)
    except (TypeError, json.JSONDecodeError):
        decoded = text
    if isinstance(decoded, str):
        return decoded.strip().lower() or "unknown"
    if isinstance(decoded, dict):
        for key in ("status", "kind", "state"):
            value = str(decoded.get(key, "") or "").strip().lower()
            if value:
                return value
    return "unknown"


def _preserve_official_cli_report_semantics(spec: NormalizeStageSpec, report: dict) -> dict:
    if str(spec.inputs.provider or "").strip().lower() != "paddle":
        return report
    try:
        payload = json.loads(spec.inputs.source_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return report
    if not isinstance(payload, dict):
        return report
    meta = payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}
    if str(meta.get("transport", "") or "").strip().lower() != "official_cli":
        return report
    model_type = str(
        meta.get("cliModelType", "") or meta.get("cli_model_type", "") or ""
    ).strip().lower()
    if not model_type:
        precision = str(meta.get("cliGeometryPrecision", "") or "").strip().lower()
        model_type = "ocr" if precision == "block_bbox" else "doc_parsing"
    return apply_cli_normalization_report_semantics(report, model_type=model_type)


def _write_normalized_artifacts_with_rollback(
    spec: NormalizeStageSpec,
    document: dict,
    report: dict,
) -> tuple[Path, Path]:
    paths = normalized_artifact_paths(spec)
    snapshots = {path: path.read_bytes() if path.is_file() else None for path in paths}
    try:
        return write_normalized_artifacts(spec, document, report)
    except Exception as write_error:
        rollback_errors: list[str] = []
        for path, content in snapshots.items():
            try:
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    _atomic_write_bytes(path, content)
            except Exception as rollback_error:
                rollback_errors.append(f"{path.name}: {type(rollback_error).__name__}")
        if rollback_errors:
            raise RuntimeError(
                f"normalized artifact write failed and rollback was incomplete ({', '.join(rollback_errors)})"
            ) from write_error
        raise


def _atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".rollback", dir=path.parent)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


def _backfill_markdown(
    *,
    job_dir: Path,
    normalized_path: Path,
    document: dict,
    write: bool,
) -> dict[str, Any]:
    markdown_path = job_dir / "md" / "full.md"
    if markdown_path.is_file():
        return {"status": "existing", "path": str(markdown_path)}
    if not render_document_markdown(document):
        return {"status": "unavailable", "path": str(markdown_path)}
    if not write:
        return {"status": "would_create", "path": str(markdown_path)}
    materialized = materialize_document_markdown_fallback(
        normalized_json_path=normalized_path,
        job_root=job_dir,
    )
    if materialized is None or not materialized.is_file():
        return {"status": "unavailable", "path": str(markdown_path)}
    return {"status": "created", "path": str(materialized)}


def _inspect_translation_manifest(job_dir: Path) -> tuple[dict[str, Any], dict[int, Path]]:
    translated_dir = job_dir / "translated"
    manifest_path = translated_dir / "translation-manifest.json"
    page_payloads = sorted(translated_dir.glob("page-*.json")) if translated_dir.is_dir() else []
    if not manifest_path.is_file():
        if page_payloads:
            return (
                {
                    "status": "unsafe_to_rebuild",
                    "path": str(manifest_path),
                    "orphan_page_payload_count": len(page_payloads),
                    "reason": "page payloads exist but canonical manifest metadata is missing",
                },
                {},
            )
        return ({"status": "not_applicable", "path": str(manifest_path), "page_count": 0}, {})
    try:
        paths = load_translation_manifest(translated_dir)
        missing = [page_idx for page_idx, path in paths.items() if not path.is_file()]
        if missing:
            return (
                {
                    "status": "invalid",
                    "path": str(manifest_path),
                    "page_count": len(paths),
                    "missing_payload_count": len(missing),
                    "reason": "manifest references missing page payloads",
                },
                {},
            )
        invalid_payload_count = 0
        for path in paths.values():
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                invalid_payload_count += 1
                continue
            if not isinstance(payload, list):
                invalid_payload_count += 1
        if invalid_payload_count:
            return (
                {
                    "status": "invalid",
                    "path": str(manifest_path),
                    "page_count": len(paths),
                    "invalid_payload_count": invalid_payload_count,
                    "reason": "manifest page payloads must be parseable JSON arrays",
                },
                {},
            )
        return ({"status": "valid", "path": str(manifest_path), "page_count": len(paths)}, paths)
    except Exception as exc:
        return (
            {
                "status": "invalid",
                "path": str(manifest_path),
                "page_count": 0,
                "reason": _safe_error(exc),
            },
            {},
        )


def _inspect_paddle_data_info_completeness(spec: NormalizeStageSpec) -> dict[str, Any]:
    """Report the payload_reader completeness decision without exposing raw metadata."""
    if str(spec.inputs.provider or "").strip().lower() != "paddle":
        return {"status": "not_applicable"}
    try:
        payload = json.loads(spec.inputs.source_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"status": "unavailable", "reason": _safe_error(exc)}
    if not isinstance(payload, dict):
        return {"status": "unavailable", "reason": "Paddle source payload is not an object"}

    meta = payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}
    data_info = payload.get("dataInfo") if isinstance(payload.get("dataInfo"), dict) else {}
    data_info_pages = data_info.get("pages") if isinstance(data_info.get("pages"), list) else []
    layout_results = (
        payload.get("layoutParsingResults")
        if isinstance(payload.get("layoutParsingResults"), list)
        else []
    )
    explicit = meta.get("dataInfoComplete")
    source = str(meta.get("source", "") or "").strip().lower()
    inferred_incomplete = (
        explicit is None
        and source == "paddle_jsonl"
        and len(data_info_pages) != len(layout_results)
    )
    if explicit is False:
        status = "explicit_incomplete"
    elif explicit is True:
        status = "explicit_complete"
    elif inferred_incomplete:
        status = "inferred_incomplete"
    else:
        status = "not_inferred"
    return {
        "status": status,
        "source": "paddle_jsonl" if source == "paddle_jsonl" else "other",
        "data_info_page_count": len(data_info_pages),
        "layout_page_count": len(layout_results),
        "effective_complete": False if explicit is False or inferred_incomplete else explicit,
    }


def _inspect_reader_derivatives(
    *,
    source_pdf: Path,
    document: dict,
    translation_paths: dict[int, Path],
    manifest_status: str,
) -> dict[str, Any]:
    source_region_count = 0
    source_block_count = 0
    for page in document.get("pages", []) or []:
        for block in page.get("blocks", []) or []:
            if not isinstance(block, dict) or not str(block.get("block_id", "") or "").strip():
                continue
            source_block_count += 1
            bbox = block.get("bbox")
            if not _usable_bbox(bbox):
                bbox = (block.get("geometry", {}) or {}).get("bbox")
            if _usable_bbox(bbox):
                source_region_count += 1

    translated_region_count = 0
    for path in translation_paths.values():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, list):
            continue
        translated_region_count += sum(
            1
            for item in payload
            if isinstance(item, dict)
            and str(item.get("item_id", "") or "").strip()
            and _usable_bbox(item.get("bbox"))
        )

    if manifest_status == "valid":
        regions_status = "derived_on_read"
    elif manifest_status == "not_applicable":
        regions_status = "source_only_derived_on_read"
    else:
        regions_status = "translated_regions_unavailable"
    return {
        "regions": {
            "status": regions_status,
            "source_block_count": source_block_count,
            "source_region_count": source_region_count,
            "translated_region_count": translated_region_count,
        },
        "metadata": {
            "status": "derived_on_read" if source_pdf.is_file() else "source_pdf_missing",
            "source_pdf_ready": source_pdf.is_file(),
            "translated_pdf": "resolved_from_job_snapshot_on_request",
        },
    }


def _usable_bbox(value: Any) -> bool:
    if not isinstance(value, list) or len(value) < 4:
        return False
    coords = value[:4]
    if not all(
        isinstance(item, (int, float))
        and not isinstance(item, bool)
        and math.isfinite(float(item))
        for item in coords
    ):
        return False
    return float(coords[2]) > float(coords[0]) and float(coords[3]) > float(coords[1])


def _unsafe_reason(manifest: dict[str, Any]) -> str:
    status = str(manifest.get("status", ""))
    if status == "unsafe_to_rebuild":
        return "translation manifest is missing while translated page payloads exist"
    if status == "invalid":
        return "translation manifest is invalid"
    return ""


def _path_sha256(path: Path) -> str:
    if not path.exists():
        return ""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _payload_sha256(payload: Any, *, compact: bool) -> str:
    kwargs: dict[str, Any] = {"ensure_ascii": False}
    if compact:
        kwargs["separators"] = (",", ":")
    else:
        kwargs["indent"] = 2
    encoder = json.JSONEncoder(**kwargs)
    digest = hashlib.sha256()
    for chunk in encoder.iterencode(payload):
        digest.update(chunk.encode("utf-8"))
    return digest.hexdigest()


def _sync_active_document_fts(
    *,
    db_path: Path,
    job_dir: Path,
    document: dict,
    write: bool,
) -> dict[str, Any]:
    if not db_path.exists():
        return {"status": "database_missing", "row_count": 0}
    rows = list(_build_fts_rows(job_dir, document))
    with sqlite3.connect(db_path, timeout=5.0) as connection:
        if not _table_exists(connection, "documents") or not _table_exists(connection, "blocks_fts"):
            raise RuntimeError("jobs database is missing documents or blocks_fts schema")
        active = connection.execute(
            "SELECT document_id FROM documents WHERE active_job_id = ?1",
            (job_dir.name,),
        ).fetchone()
        if active is None:
            return {"status": "not_active", "row_count": len(rows)}
        document_id = str(active[0])
        existing = connection.execute(
            """
            SELECT page_idx, block_id, source_text, translated_text
            FROM blocks_fts WHERE document_id = ?1 ORDER BY rowid
            """,
            (document_id,),
        ).fetchall()
        if existing == rows:
            return {"status": "unchanged", "row_count": len(rows)}
        if not write:
            return {"status": "would_refresh", "row_count": len(rows)}
        with connection:
            connection.execute("DELETE FROM blocks_fts WHERE document_id = ?1", (document_id,))
            connection.executemany(
                """
                INSERT INTO blocks_fts (
                    document_id, job_id, page_idx, block_id, source_text, translated_text
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                """,
                [
                    (document_id, job_dir.name, page_idx, block_id, source_text, translated_text)
                    for page_idx, block_id, source_text, translated_text in rows
                ],
            )
        return {"status": "refreshed", "row_count": len(rows)}


def _refresh_active_document_fts(*, db_path: Path, job_dir: Path, document: dict) -> str:
    """Compatibility helper for existing devtool callers and focused tests."""
    result = _sync_active_document_fts(
        db_path=db_path,
        job_dir=job_dir,
        document=document,
        write=True,
    )
    status = str(result["status"])
    if status in {"refreshed", "unchanged"}:
        return f"{status}:{result['row_count']}"
    return status


def _table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?1",
            (table,),
        ).fetchone()
        is not None
    )


def _build_fts_rows(job_dir: Path, document: dict) -> Iterable[tuple[int, str, str, str]]:
    """Mirror retain-data::build_fts_rows_from_job_dir without provider/LLM calls."""
    translated: dict[tuple[int, int], str] = {}
    translated_dir = job_dir / "translated"
    if translated_dir.exists():
        for path in sorted(translated_dir.glob("page-*.json")):
            try:
                items = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                page_idx = _as_int(item.get("page_idx"))
                block_idx = _as_int(item.get("block_idx"))
                text = str(item.get("translated_text", "") or "")
                if page_idx is not None and block_idx is not None and text.strip():
                    translated[(page_idx, block_idx)] = text

    assets = document.get("assets", {}) or {}
    for page in document.get("pages", []) or []:
        page_idx = _as_int(page.get("page_index")) or 0
        for block_idx, block in enumerate(page.get("blocks", []) or []):
            block_id = str(block.get("block_id", "") or "")
            source_text = _searchable_block_text(block, assets)
            translated_text = translated.get((page_idx, block_idx), "")
            if block_id and (source_text.strip() or translated_text.strip()):
                yield page_idx, block_id, source_text, translated_text


def _searchable_block_text(block: dict, assets: dict) -> str:
    source_text = str(block.get("text", "") or "").strip()
    if source_text:
        return source_text
    content = block.get("content", {}) or {}
    for key in ("search_text", "caption", "summary"):
        value = str(content.get(key, "") or "").strip()
        if value:
            return value

    asset_ids: list[str] = []
    primary = str(content.get("asset_id", "") or "").strip()
    if primary:
        asset_ids.append(primary)
    raw_asset_ids = content.get("asset_ids", [])
    if isinstance(raw_asset_ids, list):
        asset_ids.extend(str(value).strip() for value in raw_asset_ids if str(value).strip())
    descriptions: list[str] = []
    for asset_id in dict.fromkeys(asset_ids):
        asset = assets.get(asset_id, {}) if isinstance(assets, dict) else {}
        if not isinstance(asset, dict):
            continue
        for key in ("caption", "summary", "alt", "title"):
            value = str(asset.get(key, "") or "").strip()
            if value and value not in descriptions:
                descriptions.append(value)
    return " ".join(descriptions)


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _safe_error(exc: Exception) -> str:
    return f"{type(exc).__name__}: {_redact_text(str(exc))}"


def _redact_text(value: str) -> str:
    text = _URL_RE.sub("<redacted-url>", str(value or ""))
    return _SECRET_RE.sub(lambda match: f"{match.group(1)}=<redacted>", text)[:1000]


if __name__ == "__main__":
    main()
