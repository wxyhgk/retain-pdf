from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import sys
from types import SimpleNamespace

import pytest


PIPELINE_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PIPELINE_ROOT))


from devtools import backfill_normalized_documents as backfill


def test_payload_hash_matches_atomic_json_encoding(tmp_path: Path) -> None:
    from retainpdf_pipeline.services.pipeline_shared.io import save_json_atomic

    payload = {"text": "完整", "pages": [{"blocks": [1, 2]}]}
    compact_path = tmp_path / "compact.json"
    pretty_path = tmp_path / "pretty.json"
    save_json_atomic(compact_path, payload, compact=True)
    save_json_atomic(pretty_path, payload, compact=False)

    assert backfill._path_sha256(compact_path) == backfill._payload_sha256(payload, compact=True)
    assert backfill._path_sha256(pretty_path) == backfill._payload_sha256(payload, compact=False)


def test_build_fts_rows_keeps_source_and_translated_text(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-active"
    translated_dir = job_dir / "translated"
    translated_dir.mkdir(parents=True)
    (translated_dir / "page-0001.json").write_text(
        json.dumps(
            [
                {"page_idx": 0, "block_idx": 0, "translated_text": "译文"},
                {"page_idx": 0, "block_idx": 1, "translated_text": ""},
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    document = {
        "pages": [
            {
                "page_index": 0,
                "blocks": [
                    {"block_id": "p001-b0000", "text": "source"},
                    {"block_id": "p001-b0001", "text": ""},
                ],
            }
        ]
    }

    assert list(backfill._build_fts_rows(job_dir, document)) == [
        (0, "p001-b0000", "source", "译文")
    ]


def test_build_fts_rows_indexes_exact_asset_caption_for_empty_image(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-asset-caption"
    job_dir.mkdir()
    document = {
        "assets": {
            "figure-1": {
                "caption": "Absorption spectrum under applied field",
                "uri": "md/images/page-1/figure.png",
            }
        },
        "pages": [
            {
                "page_index": 0,
                "blocks": [
                    {
                        "block_id": "p001-b0004",
                        "text": "",
                        "content": {"kind": "image", "asset_ids": ["figure-1"]},
                    }
                ],
            }
        ],
    }

    assert list(backfill._build_fts_rows(job_dir, document)) == [
        (0, "p001-b0004", "Absorption spectrum under applied field", "")
    ]


def test_fts_parity_accepts_numeric_strings_and_space_joins_asset_descriptions(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-parity"
    translated_dir = job_dir / "translated"
    translated_dir.mkdir(parents=True)
    (translated_dir / "page-001.json").write_text(
        json.dumps([{"page_idx": "0", "block_idx": "0", "translated_text": "译文"}]),
        encoding="utf-8",
    )
    document = {
        "assets": {
            "figure-1": {"caption": "Caption", "summary": "Summary"},
        },
        "pages": [
            {
                "page_index": "0",
                "blocks": [
                    {
                        "block_id": "p001-b0000",
                        "text": "",
                        "content": {"asset_ids": ["figure-1"]},
                    }
                ],
            }
        ],
    }

    assert list(backfill._build_fts_rows(job_dir, document)) == [
        (0, "p001-b0000", "Caption Summary", "译文")
    ]


def test_refresh_fts_only_replaces_active_document(tmp_path: Path) -> None:
    db_path = tmp_path / "jobs.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(
        """
        CREATE TABLE documents (document_id TEXT PRIMARY KEY, active_job_id TEXT);
        CREATE TABLE blocks_fts (
            document_id TEXT,
            job_id TEXT,
            page_idx INTEGER,
            block_id TEXT,
            source_text TEXT,
            translated_text TEXT
        );
        INSERT INTO documents VALUES ('doc-active', 'job-active');
        INSERT INTO documents VALUES ('doc-other', 'job-other');
        INSERT INTO blocks_fts VALUES ('doc-active', 'job-active', 0, 'old', 'old', '');
        INSERT INTO blocks_fts VALUES ('doc-other', 'job-other', 0, 'kept', 'kept', '');
        """
    )
    connection.commit()
    connection.close()
    job_dir = tmp_path / "job-active"
    job_dir.mkdir()
    document = {
        "pages": [
            {
                "page_index": 0,
                "blocks": [{"block_id": "p001-b0000", "text": "new source"}],
            }
        ]
    }

    result = backfill._refresh_active_document_fts(
        db_path=db_path,
        job_dir=job_dir,
        document=document,
    )

    assert result == "refreshed:1"
    connection = sqlite3.connect(db_path)
    rows = connection.execute(
        "SELECT document_id, block_id, source_text FROM blocks_fts ORDER BY document_id"
    ).fetchall()
    connection.close()
    assert rows == [
        ("doc-active", "p001-b0000", "new source"),
        ("doc-other", "kept", "kept"),
    ]

    second = backfill._refresh_active_document_fts(
        db_path=db_path,
        job_dir=job_dir,
        document=document,
    )
    assert second == "unchanged:1"


def test_job_id_selector_rejects_path_traversal(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="invalid job id"):
        backfill._iter_job_dirs(tmp_path, ["../outside"])


def test_report_path_cannot_overwrite_job_artifacts(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    with pytest.raises(SystemExit, match="outside --jobs-root"):
        backfill._validated_report_path(
            str(jobs_root / "job-1" / "ocr" / "paddle_result.json"),
            jobs_root=jobs_root,
            db_path=tmp_path / "jobs.db",
        )


def test_paddle_jsonl_incomplete_data_info_is_reported_without_raw_fields(tmp_path: Path) -> None:
    source_json = tmp_path / "paddle.json"
    source_json.write_text(
        json.dumps(
            {
                "_meta": {"source": "paddle_jsonl", "authorization": "must-not-leak"},
                "dataInfo": {"pages": [{"width": 100}]},
                "layoutParsingResults": [{}, {}],
            }
        ),
        encoding="utf-8",
    )
    spec = SimpleNamespace(inputs=SimpleNamespace(provider="paddle", source_json=source_json))

    result = backfill._inspect_paddle_data_info_completeness(spec)

    assert result == {
        "status": "inferred_incomplete",
        "source": "paddle_jsonl",
        "data_info_page_count": 1,
        "layout_page_count": 2,
        "effective_complete": False,
    }
    assert "authorization" not in json.dumps(result)


def test_manifest_with_invalid_page_payload_blocks_reader_derivation(tmp_path: Path) -> None:
    translated = tmp_path / "translated"
    translated.mkdir()
    (translated / "page-001.json").write_text("{}", encoding="utf-8")
    (translated / "translation-manifest.json").write_text(
        json.dumps(
            {
                "schema": "translation_manifest_v1",
                "schema_version": 1,
                "pages": [{"page_index": 0, "path": "page-001.json"}],
            }
        ),
        encoding="utf-8",
    )

    manifest, paths = backfill._inspect_translation_manifest(tmp_path)

    assert manifest["status"] == "invalid"
    assert manifest["invalid_payload_count"] == 1
    assert paths == {}


def test_usable_bbox_requires_finite_positive_area() -> None:
    assert backfill._usable_bbox([0, 0, 10, 20]) is True
    assert backfill._usable_bbox([0, 0, 0, 20]) is False
    assert backfill._usable_bbox([0, 0, 10, float("inf")]) is False


def test_official_cli_doc_parsing_report_remains_incomplete(tmp_path: Path) -> None:
    source_json = tmp_path / "paddle-cli.json"
    source_json.write_text(
        json.dumps(
            {
                "_meta": {
                    "transport": "official_cli",
                    "cliGeometryPrecision": "page_bbox",
                }
            }
        ),
        encoding="utf-8",
    )
    spec = SimpleNamespace(inputs=SimpleNamespace(provider="paddle", source_json=source_json))
    report = {"validation": {"complete": True, "warnings": []}}

    result = backfill._preserve_official_cli_report_semantics(spec, report)

    assert result["cli_model_type"] == "doc_parsing"
    assert result["geometry_precision"] == "page_bbox"
    assert result["validation"]["complete"] is False
    assert result["validation"]["warnings"]


def test_normalized_artifact_pair_rolls_back_when_second_write_fails(
    tmp_path: Path,
    monkeypatch,
) -> None:
    normalized_path = tmp_path / "document.v1.json"
    report_path = tmp_path / "document.v1.report.json"
    normalized_path.write_bytes(b"old document")
    report_path.write_bytes(b"old report")
    spec = object()
    monkeypatch.setattr(
        backfill,
        "normalized_artifact_paths",
        lambda _spec: (normalized_path, report_path),
    )

    def fail_after_first_write(_spec, _document, _report):
        normalized_path.write_bytes(b"new document")
        raise OSError("simulated report write failure")

    monkeypatch.setattr(backfill, "write_normalized_artifacts", fail_after_first_write)

    with pytest.raises(OSError, match="simulated"):
        backfill._write_normalized_artifacts_with_rollback(spec, {}, {})

    assert normalized_path.read_bytes() == b"old document"
    assert report_path.read_bytes() == b"old report"


def test_failed_active_job_requires_explicit_opt_in(tmp_path: Path) -> None:
    db_path = tmp_path / "jobs.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(
        """
        CREATE TABLE jobs (job_id TEXT PRIMARY KEY, status_json TEXT);
        CREATE TABLE documents (document_id TEXT PRIMARY KEY, active_job_id TEXT);
        INSERT INTO jobs VALUES ('job-failed', '"failed"');
        INSERT INTO documents VALUES ('doc-1', 'job-failed');
        """
    )
    connection.commit()
    connection.close()

    result = backfill._job_backfill_eligibility(
        db_path=db_path,
        job_id="job-failed",
        include_non_succeeded=False,
        write=False,
    )

    assert result["eligible"] is False
    assert result["active"] is True


def test_process_job_dry_run_never_calls_writer(tmp_path: Path, monkeypatch) -> None:
    job_dir = tmp_path / "job-dry-run"
    spec_path = job_dir / "specs" / "normalize.spec.json"
    spec_path.parent.mkdir(parents=True)
    spec_path.write_text("{}", encoding="utf-8")
    normalized_path = job_dir / "ocr" / "normalized" / "document.v1.json"
    report_path = normalized_path.with_name("document.v1.report.json")
    spec = SimpleNamespace(
        job=SimpleNamespace(job_root=job_dir.resolve(), job_id=job_dir.name),
        inputs=SimpleNamespace(
            provider="paddle",
            source_pdf=tmp_path / "source.pdf",
            source_json=tmp_path / "source.json",
        ),
    )
    spec.inputs.source_pdf.write_bytes(b"%PDF fixture")
    spec.inputs.source_json.write_text("{}", encoding="utf-8")
    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "pages": [],
        "assets": {},
    }
    report = {
        "validation": {
            "complete": True,
            "page_count": 0,
            "block_count": 0,
            "asset_count": 0,
            "asset_block_count": 0,
            "linked_asset_block_count": 0,
            "zero_segment_bbox_count": 0,
            "approximate_segment_bbox_count": 0,
            "warnings": [],
        }
    }
    writer_calls: list[object] = []
    monkeypatch.setattr(backfill.NormalizeStageSpec, "load", lambda _path: spec)
    monkeypatch.setattr(backfill, "build_normalized_artifacts", lambda _spec: (document, report))
    monkeypatch.setattr(
        backfill,
        "normalized_artifact_paths",
        lambda _spec: (normalized_path, report_path),
    )
    monkeypatch.setattr(
        backfill,
        "write_normalized_artifacts",
        lambda *_args: writer_calls.append(object()),
    )

    result = backfill._process_job(
        job_dir,
        write=False,
        require_complete=True,
        db_path=tmp_path / "missing.db",
        refresh_fts=True,
        include_non_succeeded=True,
    )

    assert result["status"] == "would_update", result["error"]
    assert result["written"] is False
    assert result["fts"] == {"status": "database_missing", "row_count": 0}
    assert writer_calls == []


def test_process_job_accepts_legacy_ocr_spec_job_id(tmp_path: Path, monkeypatch) -> None:
    job_dir = tmp_path / "job-legacy"
    spec_path = job_dir / "specs" / "normalize.spec.json"
    spec_path.parent.mkdir(parents=True)
    spec_path.write_text("{}", encoding="utf-8")
    source_pdf = tmp_path / "source.pdf"
    source_pdf.write_bytes(b"%PDF fixture")
    source_json = tmp_path / "source.json"
    source_json.write_text("{}", encoding="utf-8")
    spec = SimpleNamespace(
        job=SimpleNamespace(job_root=job_dir.resolve(), job_id=f"{job_dir.name}-ocr"),
        inputs=SimpleNamespace(provider="paddle", source_pdf=source_pdf, source_json=source_json),
    )
    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "pages": [],
        "assets": {},
    }
    report = {"validation": {"complete": True, "warnings": []}}
    normalized_path = job_dir / "ocr" / "normalized" / "document.v1.json"
    report_path = normalized_path.with_name("document.v1.report.json")
    monkeypatch.setattr(backfill.NormalizeStageSpec, "load", lambda _path: spec)
    monkeypatch.setattr(backfill, "build_normalized_artifacts", lambda _spec: (document, report))
    monkeypatch.setattr(backfill, "normalized_artifact_paths", lambda _spec: (normalized_path, report_path))

    result = backfill._process_job(
        job_dir,
        write=False,
        require_complete=False,
        db_path=tmp_path / "missing.db",
        refresh_fts=False,
    )

    assert result["status"] == "would_update", result["error"]


def test_write_is_blocked_before_all_writers_when_manifest_is_unsafe(tmp_path: Path, monkeypatch) -> None:
    job_dir = tmp_path / "job-unsafe"
    spec_path = job_dir / "specs" / "normalize.spec.json"
    translated_dir = job_dir / "translated"
    spec_path.parent.mkdir(parents=True)
    translated_dir.mkdir(parents=True)
    spec_path.write_text("{}", encoding="utf-8")
    (translated_dir / "page-001.json").write_text("[]", encoding="utf-8")
    source_pdf = tmp_path / "source.pdf"
    source_pdf.write_bytes(b"%PDF fixture")
    source_json = tmp_path / "source.json"
    source_json.write_text("{}", encoding="utf-8")
    spec = SimpleNamespace(
        job=SimpleNamespace(job_root=job_dir.resolve(), job_id=job_dir.name),
        inputs=SimpleNamespace(provider="paddle", source_pdf=source_pdf, source_json=source_json),
    )
    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "pages": [],
        "assets": {},
    }
    report = {"validation": {"complete": True, "warnings": []}}
    normalized_path = job_dir / "ocr" / "normalized" / "document.v1.json"
    report_path = normalized_path.with_name("document.v1.report.json")
    writer_calls: list[str] = []
    monkeypatch.setattr(backfill.NormalizeStageSpec, "load", lambda _path: spec)
    monkeypatch.setattr(backfill, "build_normalized_artifacts", lambda _spec: (document, report))
    monkeypatch.setattr(backfill, "normalized_artifact_paths", lambda _spec: (normalized_path, report_path))
    monkeypatch.setattr(
        backfill,
        "_write_normalized_artifacts_with_rollback",
        lambda *_args: writer_calls.append("document"),
    )
    monkeypatch.setattr(
        backfill,
        "_sync_active_document_fts",
        lambda **_kwargs: writer_calls.append("fts") or {"status": "refreshed", "row_count": 0},
    )

    result = backfill._process_job(
        job_dir,
        write=True,
        require_complete=False,
        db_path=tmp_path / "missing.db",
        refresh_fts=True,
        include_non_succeeded=True,
    )

    assert result["status"] == "incomplete"
    assert result["fts"]["status"] == "blocked_by_manifest"
    assert writer_calls == []
