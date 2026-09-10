from __future__ import annotations

import base64
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.ocr.document_schema import validate_saved_document_path
from retainpdf_pipeline.ocr.ocr_provider.paddle_runner import run_paddle_to_job_dir


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "paddle_complex_ocr.golden.json"
GENERATOR_PATH = FIXTURE_PATH.with_name("generate_paddle_complex_ocr_golden.py")
EXPECTED_ASSETS = {
    "page-1/imgs/img_in_image_box_80_980_550_1250.png": {
        "caption": "Figure 1. Offline pipeline overview.",
        "caption_block_id": "p001-b0010",
    },
    "page-1/imgs/img_in_image_box_650_980_1120_1250.png": {
        "caption": "Figure 2. Citation region map.",
        "caption_block_id": "p001-b0013",
    },
}


def _write_source_pdf(path: Path) -> None:
    document = fitz.open()
    document.new_page(width=600, height=800)
    document.save(path)
    document.close()


def _runner_args(*, job_root: Path, source_pdf: Path) -> SimpleNamespace:
    job_dirs = resolve_job_dirs(job_root)
    return SimpleNamespace(
        job_root=str(job_dirs.root),
        source_dir=str(job_dirs.source_dir),
        ocr_dir=str(job_dirs.ocr_dir),
        translated_dir=str(job_dirs.translated_dir),
        rendered_dir=str(job_dirs.rendered_dir),
        artifacts_dir=str(job_dirs.artifacts_dir),
        logs_dir=str(job_dirs.logs_dir),
        paddle_token="offline-fixture-token",
        paddle_api_url="",
        paddle_model="PaddleOCR-VL-1.5",
        file_url="",
        file_path=str(source_pdf),
        page_ranges="",
        poll_interval=0,
        poll_timeout=1,
        ocr_provider_options={},
    )


def _usable_bbox(value: object) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 4
        and all(isinstance(item, (int, float)) for item in value)
        and value[2] > value[0]
        and value[3] > value[1]
    )


def test_complex_paddle_fixture_matches_its_offline_generator() -> None:
    subprocess.run(
        [sys.executable, str(GENERATOR_PATH), "--check"],
        check=True,
        cwd=REPO_SCRIPTS_ROOT,
    )


def test_offline_complex_paddle_payload_survives_ocr_only_pipeline(tmp_path: Path) -> None:
    """Raw Paddle JSON -> document.v1 + Markdown/assets, without network or paid APIs."""
    fixture_payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    job_root = tmp_path / "offline-paddle-complex-golden"
    job_dirs = ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = job_dirs.source_dir / "source.pdf"
    _write_source_pdf(source_pdf)

    provider_calls: list[str] = []

    def submit_local(**kwargs: object) -> tuple[str, str]:
        assert kwargs["file_path"] == source_pdf.resolve()
        assert kwargs["token"] == "offline-fixture-token"
        provider_calls.append("submit")
        return "offline-task", "offline-trace"

    def poll_until_complete(**kwargs: object) -> tuple[dict, str]:
        assert kwargs["job_id"] == "offline-task"
        progress_callback = kwargs.get("progress_callback")
        if callable(progress_callback):
            progress_callback("done", {"logId": "offline-poll"})
        provider_calls.append("poll")
        return {"state": "done"}, "fixture://paddle-complex"

    def download_jsonl(**kwargs: object) -> dict:
        assert kwargs["jsonl_url"] == "fixture://paddle-complex"
        provider_calls.append("download")
        # The runner enriches _meta; return a fresh object so the committed
        # golden payload remains immutable across repeated test runs.
        return json.loads(json.dumps(fixture_payload))

    result = run_paddle_to_job_dir(
        _runner_args(job_root=job_root, source_pdf=source_pdf),
        download_source_pdf=lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("offline fixture must not download a source PDF")
        ),
        get_token=lambda **_: "offline-fixture-token",
        submit_remote=lambda **_: (_ for _ in ()).throw(
            AssertionError("offline fixture must not submit a remote URL")
        ),
        submit_local=submit_local,
        poll_until_complete=poll_until_complete,
        download_jsonl=download_jsonl,
    )

    _, returned_source_pdf, raw_json_path, normalized_json_path = result
    report_path = normalized_json_path.with_name("document.v1.report.json")
    markdown_path = job_root / "md" / "full.md"
    expected_asset_paths = {
        asset_id: job_root / "md" / "images" / asset_id
        for asset_id in EXPECTED_ASSETS
    }

    assert provider_calls == ["submit", "poll", "download"]
    assert returned_source_pdf == source_pdf.resolve()
    assert raw_json_path.exists()
    assert normalized_json_path.exists()
    assert report_path.exists()
    assert markdown_path.exists()
    assert all(path.exists() for path in expected_asset_paths.values())

    raw_payload = json.loads(raw_json_path.read_text(encoding="utf-8"))
    assert raw_payload["_meta"]["source"] == "committed_offline_golden_fixture"
    assert raw_payload["_meta"]["transport"] == "official_http"
    raw_blocks = raw_payload["layoutParsingResults"][0]["prunedResult"]["parsing_res_list"]
    assert {
        block["block_label"]
        for block in raw_blocks
    } >= {"doc_title", "paragraph_title", "text", "display_formula", "table", "image", "figure_title"}
    assert sum(block["block_label"] == "image" for block in raw_blocks) == 2
    provider_markdown = raw_payload["layoutParsingResults"][0]["markdown"]["text"]
    assert '<img src="imgs/img_in_image_box_80_980_550_1250.png"' in provider_markdown
    assert "![Citation map](imgs/img_in_image_box_650_980_1120_1250.png)" in provider_markdown
    assert raw_payload["layoutParsingResults"][0]["prunedResult"]["layout_det_res"]["boxes"] == [
        {
            "label": "inline_formula",
            "coordinate": [250, 250, 410, 290],
            "score": 0.99,
        }
    ]

    document = json.loads(normalized_json_path.read_text(encoding="utf-8"))
    validation = validate_saved_document_path(normalized_json_path)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    page = document["pages"][0]
    blocks = page["blocks"]

    assert document["schema"] == "normalized_document_v1"
    assert document["source"]["provider"] == "paddle"
    assert document["page_count"] == 1
    assert document["derived"]["provider_payload_meta"]["source"] == (
        "committed_offline_golden_fixture"
    )
    assert document["derived"]["provider_data_info"] == {
        "type": "paddle",
        "numPages": 1,
    }
    assert page["metadata"]["provider_page_meta"] == {
        "width": 1200,
        "height": 1600,
    }
    assert page["metadata"]["column_layout_mode"] == "double"
    assert len(blocks) == 14
    assert [block["block_id"] for block in blocks] == [
        f"p001-b{index:04d}" for index in range(len(blocks))
    ]
    assert [block["page_index"] for block in blocks] == [0] * len(blocks)
    assert [block["reading_order"] for block in blocks] == list(range(len(blocks)))
    assert any(block["reading_order"] > 0 for block in blocks)
    assert all(_usable_bbox(block["bbox"]) for block in blocks)
    assert all(block["geometry"]["bbox"] == block["bbox"] for block in blocks)
    assert all(_usable_bbox(block["provenance"]["raw_bbox"]) for block in blocks)
    assert all(
        segment["bbox"][0] >= block["bbox"][0]
        and segment["bbox"][1] >= block["bbox"][1]
        and segment["bbox"][2] <= block["bbox"][2]
        and segment["bbox"][3] <= block["bbox"][3]
        for block in blocks
        for segment in block.get("segments", [])
        if _usable_bbox(segment.get("bbox"))
    )

    blocks_by_type = {block["type"]: block for block in blocks}
    title_block = next(block for block in blocks if block["sub_type"] == "title")
    assert title_block["content"]["text"] == "Offline Golden Document"
    assert title_block["layout_role"] == "title"
    assert blocks_by_type["formula"]["content"]["text"] == "E = mc^2"
    assert "<table>" in blocks_by_type["table"]["content"]["text"]

    inline_formula_block = blocks[2]
    inline_formula_segments = [
        segment
        for segment in inline_formula_block["segments"]
        if segment["type"] == "inline_formula"
    ]
    assert inline_formula_segments == [
        {
            "type": "inline_formula",
            "raw_type": "text",
            "text": "a^2+b^2=c^2",
            "bbox": [125.0, 125.0, 205.0, 145.0],
            "score": 0.99,
            "bbox_precision": "provider_layout",
        }
    ]
    assert inline_formula_block["metadata"]["provider_inline_formula_bbox_complete"] is True

    table_caption, table_block = blocks[7:9]
    assert table_caption["sub_type"] == "table_caption"
    assert table_caption["content"]["related_block_ids"] == [table_block["block_id"]]
    assert table_caption["metadata"]["caption_target_direction"] == "next"
    assert table_block["content"]["caption"] == "Table 1. Offline quality metrics."
    assert table_block["content"]["caption_block_ids"] == [table_caption["block_id"]]

    image_blocks = [block for block in blocks if block["type"] == "image"]
    assert [block["content"]["asset_id"] for block in image_blocks] == list(EXPECTED_ASSETS)
    assert set(document["assets"]) == set(EXPECTED_ASSETS)
    raw_images = fixture_payload["layoutParsingResults"][0]["markdown"]["images"]
    for image_block, (asset_id, expected) in zip(image_blocks, EXPECTED_ASSETS.items()):
        expected_uri = f"md/images/{asset_id}"
        assert image_block["content"]["asset_ids"] == [asset_id]
        assert image_block["content"]["caption"] == expected["caption"]
        assert image_block["content"]["caption_block_ids"] == [expected["caption_block_id"]]
        assert document["assets"][asset_id] == {
            "kind": "image",
            "uri": expected_uri,
            "source": "markdown_image",
            "caption": expected["caption"],
            "captions": [expected["caption"]],
            "caption_block_ids": [expected["caption_block_id"]],
        }
        raw_asset_key = asset_id.removeprefix("page-1/")
        assert expected_asset_paths[asset_id].read_bytes() == base64.b64decode(raw_images[raw_asset_key])

    # Reader regions and Markdown-AI citations consume these normalized fields.
    # Lock their source-side contract here without starting the Rust API or a browser.
    citation_target = blocks[4]
    assert {
        "block_id": citation_target["block_id"],
        "page_index": citation_target["page_index"],
        "reading_order": citation_target["reading_order"],
        "bbox": citation_target["bbox"],
        "text": citation_target["content"]["text"],
    } == {
        "block_id": "p001-b0004",
        "page_index": 0,
        "reading_order": 4,
        "bbox": [325.0, 110.0, 560.0, 195.0],
        "text": (
            "The right column starts here and remains a separate long body block with its own "
            "geometry, searchable text, and stable citation target."
        ),
    }

    markdown = markdown_path.read_text(encoding="utf-8")
    assert "# Offline Golden Document" in markdown
    assert "The left column opens" in markdown
    assert "The right column starts" in markdown
    assert "$a^2+b^2=c^2$" in markdown
    assert "$$E = mc^2$$" in markdown
    assert "Table 1. Offline quality metrics." in markdown
    assert "| Metric | Value |" in markdown
    assert "![Pipeline figure](images/page-1/imgs/img_in_image_box_80_980_550_1250.png)" in markdown
    assert "![Citation map](images/page-1/imgs/img_in_image_box_650_980_1120_1250.png)" in markdown
    assert "<img" not in markdown

    assert validation["valid"] is True
    assert validation["complete"] is True
    assert validation["asset_count"] == 2
    assert validation["referenced_asset_count"] == 2
    assert validation["unlinked_asset_block_count"] == 0
    assert validation["zero_segment_bbox_count"] == 0
    assert validation["formula_segment_count"] >= 2
    assert validation["provider_formula_segment_bbox_count"] >= 1
    assert (
        validation["provider_formula_segment_bbox_count"]
        + validation["approximate_formula_segment_bbox_count"]
        == validation["formula_segment_count"]
    )
    assert sum(validation["line_bbox_precision_counts"].values()) == sum(
        len(block.get("lines", [])) for block in blocks
    )
    assert report["validation"]["coordinate_space"] == "pdf_point"
    assert report["validation"]["geometry_bbox_consistent"] is True
    assert report["validation"]["segment_bbox_within_block"] is True
