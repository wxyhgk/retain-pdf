from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.stage_specs import NormalizeStageSpec
from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import (
    _refresh_report_for_final_document,
    _resolve_source_json_path,
)


def test_refresh_report_for_final_document_uses_final_validation_counts() -> None:
    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "document_id": "report-doc",
        "page_count": 1,
        "source": {"provider": "paddle"},
        "derived": {"provider_signals": {"materialized_page_asset_count": 2}},
        "markers": {},
        "pages": [
            {
                "page_index": 0,
                "page": 1,
                "width": 320.0,
                "height": 480.0,
                "unit": "pt",
                "blocks": [
                    {
                        "block_id": "p001-b001",
                        "page_index": 0,
                        "order": 0,
                        "reading_order": 0,
                        "geometry": {"bbox": [10.0, 10.0, 100.0, 30.0]},
                        "content": {"kind": "text", "text": "kept"},
                        "layout_role": "paragraph",
                        "semantic_role": "body",
                        "structure_role": "body",
                        "policy": {"translate": True, "translate_reason": "body"},
                        "provenance": {
                            "provider": "paddle",
                            "raw_label": "text",
                            "raw_sub_type": "body",
                            "raw_bbox": [10.0, 10.0, 100.0, 30.0],
                            "raw_path": "layoutParsingResults[0]",
                        },
                        "continuation_hint": {
                            "source": "",
                            "group_id": "",
                            "role": "single",
                            "scope": "",
                            "reading_order": 0,
                            "confidence": 0.0,
                        },
                        "metadata": {},
                        "source": {"provider": "paddle"},
                    },
                    {
                        "block_id": "p001-b002",
                        "page_index": 0,
                        "order": 1,
                        "reading_order": 1,
                        "geometry": {"bbox": [10.0, 40.0, 120.0, 60.0]},
                        "content": {"kind": "text", "text": "rebuilt"},
                        "layout_role": "paragraph",
                        "semantic_role": "body",
                        "structure_role": "body",
                        "policy": {"translate": True, "translate_reason": "body"},
                        "provenance": {
                            "provider": "paddle",
                            "raw_label": "text",
                            "raw_sub_type": "body",
                            "raw_bbox": [10.0, 40.0, 120.0, 60.0],
                            "raw_path": "layoutParsingResults[1]",
                        },
                        "continuation_hint": {
                            "source": "",
                            "group_id": "",
                            "role": "single",
                            "scope": "",
                            "reading_order": 1,
                            "confidence": 0.0,
                        },
                        "metadata": {},
                        "source": {"provider": "paddle"},
                    },
                ],
            }
        ],
    }
    stale_report = {
        "provider": "paddle",
        "validation": {"valid": True, "page_count": 1, "block_count": 1},
        "defaults": {"pages_seen": 1, "blocks_seen": 1},
    }

    refreshed = _refresh_report_for_final_document(stale_report, document)

    assert refreshed["validation"]["page_count"] == 1
    assert refreshed["validation"]["block_count"] == 2
    assert refreshed["defaults"]["pages_seen"] == 1
    assert refreshed["defaults"]["blocks_seen"] == 2
    assert refreshed["provider_signals"]["materialized_page_asset_count"] == 2


def test_normalize_stage_discovers_current_mineru_middle_filename(
    tmp_path: Path,
) -> None:
    job_root = tmp_path / "jobs" / "job-mineru"
    raw_dir = job_root / "ocr" / "unpacked"
    raw_dir.mkdir(parents=True)
    middle_json = raw_dir / "paper_middle.json"
    middle_json.write_text("{}", encoding="utf-8")
    source_pdf = job_root / "source" / "paper.pdf"
    source_pdf.parent.mkdir(parents=True)
    source_pdf.write_bytes(b"%PDF-1.4\n%%EOF\n")
    spec_path = job_root / "specs" / "normalize.spec.json"
    spec_path.parent.mkdir(parents=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "normalize.stage.v1",
                "stage": "normalize",
                "job": {
                    "job_id": "job-mineru",
                    "job_root": str(job_root),
                    "workflow": "ocr",
                },
                "inputs": {
                    "provider": "mineru",
                    "source_json": str(raw_dir / "layout.json"),
                    "source_pdf": str(source_pdf),
                    "provider_version": "vlm",
                    "provider_raw_dir": str(raw_dir),
                },
                "params": {},
            }
        ),
        encoding="utf-8",
    )

    spec = NormalizeStageSpec.load(spec_path)

    assert _resolve_source_json_path(spec) == middle_json.resolve()


def test_validation_asset_link_counts_only_image_blocks() -> None:
    from retainpdf_pipeline.ocr.document_schema.validator import (
        build_validation_report,
    )

    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "document_id": "asset-count-doc",
        "page_count": 1,
        "source": {"provider": "paddle"},
        "derived": {},
        "markers": {},
        "assets": {
            "asset-table": {"kind": "image", "uri": "table.png", "source": "paddle"},
        },
        "pages": [
            {
                "page_index": 0,
                "page": 1,
                "width": 320.0,
                "height": 480.0,
                "unit": "pt",
                "blocks": [
                    _validation_block(
                        block_id="p001-b001",
                        order=0,
                        kind="table",
                        asset_id="asset-table",
                    ),
                    _validation_block(
                        block_id="p001-b002",
                        order=1,
                        kind="image",
                        asset_id="",
                    ),
                ],
            }
        ],
    }

    report = build_validation_report(document)

    assert report["asset_block_count"] == 1
    assert report["linked_asset_block_count"] == 0
    assert report["unlinked_asset_block_count"] == 1
    assert report["complete"] is False


def test_validation_report_detects_orphan_and_uncovered_provider_assets() -> None:
    from retainpdf_pipeline.ocr.document_schema.validator import (
        build_validation_report,
    )

    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "document_id": "asset-coverage",
        "page_count": 1,
        "source": {"provider": "paddle"},
        "derived": {},
        "markers": {},
        "assets": {
            "linked.png": {
                "kind": "image",
                "uri": "md/images/page-1/linked.png",
                "source": "paddle",
            },
            "orphan.png": {
                "kind": "image",
                "uri": "md/images/page-1/orphan.png",
                "source": "paddle",
            },
        },
        "pages": [
            {
                "page_index": 0,
                "page": 1,
                "width": 320.0,
                "height": 480.0,
                "unit": "pt",
                "metadata": {
                    "markdown": {
                        "images": {
                            "linked.png": "md/images/page-1/linked.png",
                            "missing.png": "md/images/page-1/missing.png",
                        }
                    }
                },
                "blocks": [
                    _validation_block(
                        block_id="p001-b001",
                        order=0,
                        kind="table",
                        asset_id="linked.png",
                    )
                ],
            }
        ],
    }

    report = build_validation_report(document)

    assert report["referenced_asset_count"] == 1
    assert report["unreferenced_asset_count"] == 1
    assert report["provider_markdown_image_count"] == 2
    assert report["covered_provider_markdown_image_count"] == 1
    assert report["uncovered_provider_markdown_image_count"] == 1
    assert report["complete"] is False
    assert len(report["warnings"]) == 2


def _validation_block(*, block_id: str, order: int, kind: str, asset_id: str) -> dict:
    content = {"kind": kind, "text": ""}
    if asset_id:
        content["asset_id"] = asset_id
    return {
        "block_id": block_id,
        "page_index": 0,
        "order": order,
        "reading_order": order,
        "geometry": {"bbox": [10.0, 10.0 + order * 30, 100.0, 30.0 + order * 30]},
        "content": content,
        "layout_role": "unknown",
        "semantic_role": "unknown",
        "structure_role": "",
        "policy": {"translate": False, "translate_reason": "non-text"},
        "provenance": {
            "provider": "paddle",
            "raw_label": kind,
            "raw_sub_type": "",
            "raw_bbox": [10.0, 10.0, 100.0, 30.0],
            "raw_path": "layoutParsingResults[0]",
        },
        "continuation_hint": {
            "source": "",
            "group_id": "",
            "role": "single",
            "scope": "",
            "reading_order": order,
            "confidence": 0.0,
        },
        "metadata": {},
        "source": {"provider": "paddle"},
    }
