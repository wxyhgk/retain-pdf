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
NORMALIZE_ENTRYPOINT = REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "entrypoints" / "run_normalize_ocr.py"

def test_paddle_build_lines_splits_tall_body_block_into_pseudo_lines() -> None:
    bbox = [53.48, 640.259, 292.39, 699.736]
    text = (
        "Theoretical studies of the effects of substituents on absorption and emission spectra have "
        "been performed, including studies on the indigo molecule and related compounds."
    )

    lines = build_lines(
        bbox=bbox,
        segments=[],
        text=text,
        raw_label="text",
        block_type="text",
        sub_type="body",
    )

    assert len(lines) >= 3
    assert all(len(line.get("bbox", [])) == 4 for line in lines)
    assert all(line["bbox_precision"] == "synthetic_wrap" for line in lines)
    assert all(line["spans"] for line in lines)
    assert "Theoretical studies" in lines[0]["spans"][0]["text"]


def test_paddle_build_lines_marks_explicit_newlines_as_synthetic_geometry() -> None:
    lines = build_lines(
        bbox=[10.0, 20.0, 210.0, 80.0],
        segments=[],
        text="First provider line\nSecond provider line",
        raw_label="text",
        block_type="text",
        sub_type="body",
    )

    assert [line["bbox_precision"] for line in lines] == [
        "synthetic_newline",
        "synthetic_newline",
    ]
