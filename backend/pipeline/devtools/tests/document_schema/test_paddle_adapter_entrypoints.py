import json
import subprocess
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle import looks_like_paddle_layout
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import (
    analyze_page_column_signals,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.body_repair import repair_body_cross_column_blocks
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import build_lines
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.adapter import build_paddle_document
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.relations import classify_page_blocks
from retainpdf_pipeline.translate.core.ocr.json_extractor import extract_text_items
from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from devtools.tests.document_schema.fixtures.registry import PADDLE_FIXTURES_ROOT


PADDLE_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_full.json"
PADDLE_SCI_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_sci.json"
PADDLE_FIXTURE_PDF = PADDLE_FIXTURES_ROOT / "paddle_ocr_json_split.pdf"
NORMALIZE_ENTRYPOINT_MODULE = "retainpdf_pipeline.entrypoints.run_normalize_ocr"

def test_paddle_adapter_builds_document_v1_from_sample() -> None:
    payload = json.loads(PADDLE_FIXTURE_JSON.read_text(encoding="utf-8"))

    assert looks_like_paddle_layout(payload) is True

    document, report = adapt_path_to_document_v1_with_report(
        source_json_path=PADDLE_FIXTURE_JSON,
        document_id="paddle-sample-doc",
        provider="paddle",
        provider_version="PaddleOCR-VL",
    )

    assert document["schema"] == "normalized_document_v1"
    assert document["source"]["provider"] == "paddle"
    assert document["doc_id"] == "paddle-sample-doc"
    assert isinstance(document["assets"], dict)
    assert document["page_count"] >= 1
    assert document["pages"][0]["blocks"]
    assert document["pages"][0]["page"] == 1
    first_block = document["pages"][0]["blocks"][0]
    assert "reading_order" in first_block
    assert "geometry" in first_block
    assert "content" in first_block
    assert "layout_role" in first_block
    assert "semantic_role" in first_block
    assert "policy" in first_block
    assert "provenance" in first_block
    assert report["provider"] == "paddle"
    assert report["detected_provider"] == "paddle"
    assert report["provider_signals"]["provider"] == "paddle"
    assert "suspicious_cross_column_merge_pages" in report["provider_signals"]


def test_run_normalize_ocr_supports_paddle_provider(tmp_path: Path) -> None:
    job_root = tmp_path / "20260416-paddle-normalize"
    ensure_job_dirs(resolve_job_dirs(job_root))
    specs_dir = job_root / "specs"
    specs_dir.mkdir(parents=True, exist_ok=True)
    spec_path = specs_dir / "normalize.spec.json"

    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "normalize.stage.v1",
                "stage": "normalize",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "ocr",
                },
                "inputs": {
                    "provider": "paddle",
                    "source_json": str(PADDLE_FIXTURE_JSON),
                    "source_pdf": str(PADDLE_FIXTURE_PDF),
                    "provider_version": "PaddleOCR-VL",
                    "provider_result_json": str(PADDLE_FIXTURE_JSON),
                    "provider_zip": "",
                    "provider_raw_dir": "",
                },
                "params": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    completed = subprocess.run(
        [sys.executable, "-m", NORMALIZE_ENTRYPOINT_MODULE, "--spec", str(spec_path)],
        check=True,
        capture_output=True,
        cwd=REPO_SCRIPTS_ROOT,
        text=True,
    )

    normalized_json = job_root / "ocr" / "normalized" / "document.v1.json"
    normalized_report = job_root / "ocr" / "normalized" / "document.v1.report.json"
    assert normalized_json.exists()
    assert normalized_report.exists()

    normalized_payload = json.loads(normalized_json.read_text(encoding="utf-8"))
    normalized_report_payload = json.loads(normalized_report.read_text(encoding="utf-8"))

    assert normalized_payload["source"]["provider"] == "paddle"
    assert "assets" in normalized_payload
    assert normalized_payload["pages"][0]["page"] == 1
    assert normalized_payload["page_count"] >= 1
    assert normalized_report_payload["provider"] == "paddle"
    assert "schema version: document.v1" in completed.stdout
