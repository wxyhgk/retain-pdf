from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.ocr.ocr_provider import provider_pipeline


def _write_source_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=320, height=480)
    page.insert_text((72, 72), "provider pipeline paddle smoke")
    doc.save(path)
    doc.close()


def test_ocr_summary_preserves_transport_level_incomplete_validation(
    tmp_path: Path,
    monkeypatch,
) -> None:
    normalized_path = tmp_path / "document.v1.json"
    normalized_path.write_text("{}", encoding="utf-8")
    report_path = tmp_path / "document.v1.report.json"
    report_path.write_text(
        json.dumps(
            {
                "validation": {
                    "valid": True,
                    "complete": False,
                    "warnings": ["page-level geometry only"],
                    "geometry_precision": "page_bbox",
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        provider_pipeline,
        "validate_saved_document_path",
        lambda _path: {"valid": True, "complete": True, "warnings": []},
    )

    validation = provider_pipeline._schema_validation_for_summary(
        normalized_json_path=normalized_path,
        normalization_report_path=report_path,
    )

    assert validation["valid"] is True
    assert validation["complete"] is False
    assert validation["geometry_precision"] == "page_bbox"
    assert validation["warnings"] == ["page-level geometry only"]


def test_provider_pipeline_dispatches_to_paddle_and_writes_standard_artifacts(
    tmp_path: Path,
    monkeypatch,
) -> None:
    job_root = tmp_path / "20260418-provider-paddle-e2e"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)

    spec_path = job_root / "specs" / "provider.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "provider.stage.v1",
                "stage": "provider",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "book",
                },
                "source": {
                    "file_url": "",
                    "file_path": str(source_pdf),
                },
                "ocr": {
                    "provider": "paddle",
                    "credential_ref": "env:RETAIN_PADDLE_API_TOKEN",
                    "model_version": "vlm",
                    "paddle_api_url": "",
                    "paddle_model": "PaddleOCR-VL-1.5",
                    "is_ocr": False,
                    "disable_formula": False,
                    "disable_table": False,
                    "language": "ch",
                    "page_ranges": "",
                    "data_id": "",
                    "no_cache": False,
                    "cache_tolerance": 900,
                    "extra_formats": "",
                    "poll_interval": 1,
                    "poll_timeout": 5,
                },
                "translation": {
                    "start_page": 0,
                    "end_page": -1,
                    "batch_size": 8,
                    "workers": 1,
                    "mode": "sci",
                    "math_mode": "direct_typst",
                    "skip_title_translation": False,
                    "classify_batch_size": 12,
                    "rule_profile_name": "general_sci",
                    "custom_rules_text": "",
                    "glossary_id": "",
                    "glossary_name": "",
                    "glossary_resource_entry_count": 0,
                    "glossary_inline_entry_count": 0,
                    "glossary_overridden_entry_count": 0,
                    "glossary_entries": [],
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "",
                },
                "render": {
                    "render_mode": "auto",
                    "compile_workers": 0,
                    "typst_font_family": "Source Han Serif SC",
                    "pdf_compress_dpi": 150,
                    "translated_pdf_name": "book-translated.pdf",
                    "body_font_size_factor": 1.0,
                    "body_leading_factor": 1.0,
                    "inner_bbox_shrink_x": 0.0,
                    "inner_bbox_shrink_y": 0.0,
                    "inner_bbox_dense_shrink_x": 0.0,
                    "inner_bbox_dense_shrink_y": 0.0,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    def _fake_adapt_path_to_document_v1_with_report(**_: object) -> tuple[dict, dict]:
        return (
            {
                "schema": "normalized_document_v1",
                "schema_version": "1.1",
                "document_id": job_root.name,
                "page_count": 1,
                "source": {
                    "provider": "paddle",
                    "provider_version": "PaddleOCR-VL-1.5",
                    "source_path": str(job_dirs.ocr_dir / "result.json"),
                },
                "derived": {},
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
                                "geometry": {"bbox": [72.0, 60.0, 220.0, 90.0]},
                                "content": {
                                    "kind": "text",
                                    "text": "provider pipeline paddle smoke",
                                    "line_texts": ["provider pipeline paddle smoke"],
                                },
                                "layout_role": "paragraph",
                                "semantic_role": "body",
                                "structure_role": "body",
                                "policy": {"translate": True, "translate_reason": "body"},
                                "provenance": {
                                    "provider": "paddle",
                                    "raw_label": "text",
                                    "raw_sub_type": "body",
                                    "raw_bbox": [72.0, 60.0, 220.0, 90.0],
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
                                "source": {
                                    "provider": "paddle",
                                    "raw_type": "text",
                                    "raw_bbox": [72.0, 60.0, 220.0, 90.0],
                                },
                                "bbox": [72.0, 60.0, 220.0, 90.0],
                                "type": "text",
                                "sub_type": "body",
                                "text": "provider pipeline paddle smoke",
                                "lines": [],
                                "segments": [],
                            }
                        ],
                    }
                ],
            },
            {
                "provider": "paddle",
                "detected_provider": "paddle",
                "provider_was_explicit": True,
                "defaults": {
                    "pages_seen": 1,
                    "blocks_seen": 1,
                    "document_defaults": {},
                    "page_defaults": {},
                    "block_defaults": {},
                },
                "validation": {
                    "valid": True,
                    "schema": "normalized_document_v1",
                    "schema_version": "1.1",
                    "page_count": 1,
                    "block_count": 1,
                },
                "detection": {
                    "matched": True,
                    "attempts": ["paddle"],
                },
            },
        )

    def _fake_run_book_pipeline(**kwargs: object) -> dict:
        output_pdf_path = Path(str(kwargs["output_pdf_path"]))
        output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
        output_pdf_path.write_bytes(b"%PDF-1.4\n")
        return {
            "output_dir": Path(str(kwargs["output_dir"])),
            "output_pdf_path": output_pdf_path,
            "pages_processed": 1,
            "translated_items_total": 1,
            "rule_profile_name": "general_sci",
            "glossary": {},
            "translate_elapsed": 0.1,
            "save_elapsed": 0.2,
            "total_elapsed": 0.3,
            "effective_render_mode": "overlay",
            "translation_diagnostics_path": "",
            "translation_provider_family": "deepseek_official",
            "translation_peak_inflight_requests": 1,
            "translation_timeout_attempts": 0,
            "translation_retrying_items": 0,
        }

    def _fake_write_pipeline_summary(**kwargs: object) -> None:
        summary_path = Path(str(kwargs["summary_path"]))
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(
            json.dumps(
                {
                    "job_root": str(kwargs["job_root"]),
                    "source_pdf": str(kwargs["source_pdf_path"]),
                    "layout_json": str(kwargs["layout_json_path"]),
                    "normalized_document_json": str(kwargs["normalized_json_path"]),
                    "output_pdf": str(kwargs["result"]["output_pdf_path"]),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    monkeypatch.setattr(provider_pipeline, "get_paddle_token", lambda **_: "paddle-token")
    monkeypatch.setattr(
        provider_pipeline,
        "get_api_key",
        lambda *_args, **_kwargs: "test-deepseek-key",
    )
    monkeypatch.setattr(provider_pipeline, "submit_local_paddle_file", lambda **_: ("job-1", "trace-1"))
    def _fake_poll_paddle_until_done(**kwargs: object) -> tuple[dict, str]:
        progress_callback = kwargs.get("progress_callback")
        if callable(progress_callback):
            progress_callback("running", {"logId": "poll-trace-1"})
            progress_callback("done", {"logId": "poll-trace-2"})
        return {}, "https://example.test/result.jsonl"

    monkeypatch.setattr(provider_pipeline, "poll_paddle_until_done", _fake_poll_paddle_until_done)
    monkeypatch.setattr(
        provider_pipeline,
        "download_jsonl_result",
        lambda **_: {
            "layoutParsingResults": [
                {
                    "blockLabel": "text",
                    "text": "provider pipeline paddle smoke",
                    "markdown": {
                        "text": "<div style=\"text-align: center;\"><img src=\"imgs/figure-1.png\" alt=\"Image\" width=\"48%\" /></div>",
                        "images": {
                            "imgs/figure-1.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII="
                        },
                    },
                }
            ],
            "dataInfo": {},
            "_meta": {},
        },
    )
    monkeypatch.setattr(
        provider_pipeline,
        "adapt_path_to_document_v1_with_report",
        _fake_adapt_path_to_document_v1_with_report,
    )
    monkeypatch.setattr(
        provider_pipeline,
        "validate_saved_document_path",
        lambda _: {
            "schema": "normalized_document_v1",
            "schema_version": "1.1",
            "page_count": 1,
            "block_count": 1,
        },
    )
    monkeypatch.setattr(provider_pipeline, "build_paddle_lines", lambda **_: [])
    monkeypatch.setattr(provider_pipeline, "tighten_paddle_text_bbox", lambda **kwargs: kwargs["bbox"])
    monkeypatch.setattr(provider_pipeline, "run_book_pipeline", _fake_run_book_pipeline)
    monkeypatch.setattr(provider_pipeline, "write_pipeline_summary", _fake_write_pipeline_summary)
    monkeypatch.setattr(provider_pipeline, "print_pipeline_summary", lambda **_: None)
    monkeypatch.setattr(provider_pipeline, "enable_job_log_capture", lambda *_args, **_kwargs: None)

    monkeypatch.setattr(sys, "argv", ["run_provider_case.py", "--spec", str(spec_path)])
    provider_pipeline.main()

    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    normalized_report_path = job_dirs.ocr_dir / "normalized" / "document.v1.report.json"
    provider_result_path = job_dirs.ocr_dir / "result.json"
    summary_path = job_dirs.artifacts_dir / "pipeline_summary.json"
    events_path = job_dirs.logs_dir / "pipeline_events.jsonl"
    output_pdf_path = job_dirs.rendered_dir / "book-translated.pdf"
    markdown_path = job_root / "md" / "full.md"
    markdown_image_path = job_root / "md" / "images" / "page-1" / "imgs" / "figure-1.png"

    assert provider_result_path.exists()
    assert normalized_json_path.exists()
    assert normalized_report_path.exists()
    assert summary_path.exists()
    assert events_path.exists()
    assert output_pdf_path.exists()
    assert markdown_path.exists()
    assert markdown_image_path.exists()
    assert "![Image](images/page-1/imgs/figure-1.png)" in markdown_path.read_text(encoding="utf-8")

    normalized_payload = json.loads(normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "paddle"
    provider_payload = json.loads(provider_result_path.read_text(encoding="utf-8"))
    assert provider_payload["_meta"]["transport"] == "official_http"
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    events_payload = [
        json.loads(line)
        for line in events_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert summary_payload["layout_json"] == str(provider_result_path)
    assert summary_payload["normalized_document_json"] == str(normalized_json_path)
    assert summary_payload["output_pdf"] == str(output_pdf_path)
    assert events_payload[0]["event_type"] == "stage_transition"
    assert events_payload[0]["stage"] == "startup"
    ocr_progress_events = [
        item
        for item in events_payload
        if item["stage"] == "ocr_processing" and item["event_type"] == "stage_progress"
    ]
    assert ocr_progress_events
    assert any(item["progress_total"] == 1 for item in ocr_progress_events)
    assert any(item["progress_current"] == 1 for item in ocr_progress_events)
    assert all(item["user_stage"] == "ocr" for item in ocr_progress_events)
    assert all(item["progress_unit"] == "page" for item in ocr_progress_events)
    assert any(item["stage"] == "normalizing" for item in events_payload)
    assert any(item["event_type"] == "artifact_published" for item in events_payload)


def test_provider_pipeline_discovers_configured_local_provider(
    tmp_path: Path,
    monkeypatch,
) -> None:
    job_root = tmp_path / "20260616-provider-local-dynamic"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)
    local_script = tmp_path / "fake_dynamic_local_ocr.py"
    local_script.write_text(
        """
import json
import os
from pathlib import Path

assert os.environ["RETAIN_OCR_PROVIDER"] == "local-fast"
target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "provider": "generic_flat_ocr",
    "pages": [{
        "width": 320,
        "height": 480,
        "unit": "pt",
        "blocks": [{
            "type": "text",
            "sub_type": "body",
            "bbox": [72.0, 60.0, 220.0, 90.0],
            "text": "dynamic local provider smoke"
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "ocr_providers.json"
    config_path.write_text(
        json.dumps(
            {
                "providers": {
                    "local-fast": {
                        "display_name": "Local Fast OCR",
                        "kind": "local_command",
                        "credential": None,
                        "options": {
                            "command": {
                                "type": "string",
                                "default": f"{sys.executable} {local_script}",
                            },
                            "raw_provider": {
                                "type": "string",
                                "default": "generic_flat_ocr",
                            },
                        },
                    }
                }
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    spec_path = job_root / "specs" / "provider.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "provider.stage.v1",
                "stage": "provider",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "book",
                },
                "source": {
                    "file_url": "",
                    "file_path": str(source_pdf),
                },
                "ocr": {
                    "provider": "local-fast",
                    "credential_ref": "",
                    "options": {
                        "raw_provider": "generic_flat_ocr",
                    },
                },
                "translation": {
                    "start_page": 0,
                    "end_page": -1,
                    "batch_size": 8,
                    "workers": 1,
                    "mode": "sci",
                    "math_mode": "direct_typst",
                    "skip_title_translation": False,
                    "classify_batch_size": 12,
                    "rule_profile_name": "general_sci",
                    "custom_rules_text": "",
                    "glossary_id": "",
                    "glossary_name": "",
                    "glossary_resource_entry_count": 0,
                    "glossary_inline_entry_count": 0,
                    "glossary_overridden_entry_count": 0,
                    "glossary_entries": [],
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "",
                },
                "render": {
                    "render_mode": "auto",
                    "compile_workers": 0,
                    "typst_font_family": "Source Han Serif SC",
                    "pdf_compress_dpi": 150,
                    "translated_pdf_name": "book-translated.pdf",
                    "body_font_size_factor": 1.0,
                    "body_leading_factor": 1.0,
                    "inner_bbox_shrink_x": 0.0,
                    "inner_bbox_shrink_y": 0.0,
                    "inner_bbox_dense_shrink_x": 0.0,
                    "inner_bbox_dense_shrink_y": 0.0,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    def _fake_run_book_pipeline(**kwargs: object) -> dict:
        output_pdf_path = Path(str(kwargs["output_pdf_path"]))
        output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
        output_pdf_path.write_bytes(b"%PDF-1.4\n")
        return {
            "output_dir": Path(str(kwargs["output_dir"])),
            "output_pdf_path": output_pdf_path,
            "pages_processed": 1,
            "translated_items_total": 1,
            "rule_profile_name": "general_sci",
            "glossary": {},
            "translate_elapsed": 0.1,
            "save_elapsed": 0.2,
            "total_elapsed": 0.3,
            "effective_render_mode": "overlay",
            "translation_diagnostics_path": "",
            "translation_provider_family": "deepseek_official",
            "translation_peak_inflight_requests": 1,
            "translation_timeout_attempts": 0,
            "translation_retrying_items": 0,
        }

    def _fake_write_pipeline_summary(**kwargs: object) -> None:
        summary_path = Path(str(kwargs["summary_path"]))
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(
            json.dumps(
                {
                    "normalized_document_json": str(kwargs["normalized_json_path"]),
                    "output_pdf": str(kwargs["result"]["output_pdf_path"]),
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    monkeypatch.setenv("RETAIN_OCR_PROVIDER_CONFIG", str(config_path))
    import importlib
    import retainpdf_pipeline.ocr.ocr_provider_config as provider_config
    import retainpdf_pipeline.ocr.ocr_provider.drivers as drivers

    importlib.reload(provider_config)
    importlib.reload(drivers)
    monkeypatch.setattr(provider_pipeline, "run_book_pipeline", _fake_run_book_pipeline)
    monkeypatch.setattr(
        provider_pipeline,
        "get_api_key",
        lambda *_args, **_kwargs: "test-deepseek-key",
    )
    monkeypatch.setattr(provider_pipeline, "write_pipeline_summary", _fake_write_pipeline_summary)
    monkeypatch.setattr(provider_pipeline, "print_pipeline_summary", lambda **_: None)
    monkeypatch.setattr(provider_pipeline, "enable_job_log_capture", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(sys, "argv", ["run_provider_case.py", "--spec", str(spec_path)])

    provider_pipeline.main()

    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    summary_path = job_dirs.artifacts_dir / "pipeline_summary.json"
    output_pdf_path = job_dirs.rendered_dir / "book-translated.pdf"
    assert normalized_json_path.exists()
    assert summary_path.exists()
    assert output_pdf_path.exists()
    normalized_payload = json.loads(normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "generic_flat_ocr"
    assert normalized_payload["pages"][0]["blocks"][0]["text"] == "dynamic local provider smoke"


def test_provider_pipeline_ocr_workflow_stops_after_normalization(
    tmp_path: Path,
    monkeypatch,
) -> None:
    job_root = tmp_path / "20260616-provider-ocr-only"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)
    local_script = tmp_path / "fake_ocr_only.py"
    local_script.write_text(
        """
import json
import os
from pathlib import Path

target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "provider": "generic_flat_ocr",
    "pages": [{
        "width": 320,
        "height": 480,
        "blocks": [{
            "type": "text",
            "bbox": [72.0, 60.0, 220.0, 90.0],
            "text": "ocr only provider smoke"
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    spec_path = job_root / "specs" / "provider.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "provider.stage.v1",
                "stage": "provider",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "ocr",
                },
                "source": {"file_url": "", "file_path": str(source_pdf)},
                "ocr": {
                    "provider": "local",
                    "credential_ref": "",
                    "options": {
                        "command": f"{sys.executable} {local_script}",
                        "raw_provider": "generic_flat_ocr",
                    },
                },
                "translation": {"credential_ref": "", "glossary_entries": []},
                "render": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    def _unexpected_run_book_pipeline(**_: object) -> dict:
        raise AssertionError("ocr workflow must not run translation/render pipeline")

    monkeypatch.setattr(provider_pipeline, "run_book_pipeline", _unexpected_run_book_pipeline)
    monkeypatch.setattr(provider_pipeline, "enable_job_log_capture", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(sys, "argv", ["run_provider_ocr.py", "--spec", str(spec_path)])

    provider_pipeline.main()

    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    summary_path = job_dirs.artifacts_dir / "pipeline_summary.json"
    events_path = job_dirs.logs_dir / "pipeline_events.jsonl"
    assert normalized_json_path.exists()
    assert summary_path.exists()
    assert events_path.exists()
    assert not (job_dirs.rendered_dir / "book-translated.pdf").exists()
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary_payload["normalized_document_json"] == str(normalized_json_path)
    events_payload = [
        json.loads(line)
        for line in events_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert any(item["stage"] == "finished" for item in events_payload)


def test_provider_pipeline_discovers_remote_command_provider_for_ocr_only(
    tmp_path: Path,
    monkeypatch,
) -> None:
    job_root = tmp_path / "20260616-provider-remote-command-ocr-only"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    remote_script = tmp_path / "fake_remote_command_provider.py"
    remote_script.write_text(
        """
import json
import os
from pathlib import Path

assert os.environ["RETAIN_OCR_PROVIDER"] == "remote-fast"
assert os.environ["RETAIN_OCR_PROVIDER_KIND"] == "remote_command"
assert os.environ["RETAIN_OCR_SOURCE_PDF"] == ""
assert os.environ["RETAIN_OCR_SOURCE_URL"] == "https://example.test/source.pdf"
assert os.environ["RETAIN_OCR_CREDENTIAL"] == "remote-token"

source_dir = Path(os.environ["RETAIN_OCR_SOURCE_DIR"])
source_dir.mkdir(parents=True, exist_ok=True)
(source_dir / "downloaded.pdf").write_bytes(b"%PDF-1.4\\n")

target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "provider": "generic_flat_ocr",
    "pages": [{
        "width": 320,
        "height": 480,
        "blocks": [{
            "type": "text",
            "bbox": [72.0, 60.0, 220.0, 90.0],
            "text": "remote command pipeline smoke"
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "ocr_providers.json"
    config_path.write_text(
        json.dumps(
            {
                "providers": {
                    "remote-fast": {
                        "display_name": "Remote Fast OCR",
                        "kind": "remote_command",
                        "credential": {
                            "field": "credential",
                            "env": "RETAIN_REMOTE_FAST_TOKEN",
                            "required_for": ["remote_url"],
                        },
                        "options": {
                            "command": {
                                "type": "string",
                                "default": f"{sys.executable} {remote_script}",
                            },
                            "raw_provider": {
                                "type": "string",
                                "default": "generic_flat_ocr",
                            },
                        },
                    }
                }
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    spec_path = job_root / "specs" / "provider.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "provider.stage.v1",
                "stage": "provider",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "ocr",
                },
                "source": {
                    "file_url": "https://example.test/source.pdf",
                    "file_path": "",
                },
                "ocr": {
                    "provider": "remote-fast",
                    "credential_ref": "env:RETAIN_REMOTE_FAST_TOKEN",
                    "options": {
                        "raw_provider": "generic_flat_ocr",
                    },
                },
                "translation": {"credential_ref": "", "glossary_entries": []},
                "render": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    def _unexpected_run_book_pipeline(**_: object) -> dict:
        raise AssertionError("ocr workflow must not run translation/render pipeline")

    monkeypatch.setenv("RETAIN_OCR_PROVIDER_CONFIG", str(config_path))
    monkeypatch.setenv("RETAIN_REMOTE_FAST_TOKEN", "remote-token")
    import importlib
    import retainpdf_pipeline.ocr.ocr_provider_config as provider_config
    import retainpdf_pipeline.ocr.ocr_provider.drivers as drivers

    importlib.reload(provider_config)
    importlib.reload(drivers)
    monkeypatch.setattr(provider_pipeline, "run_book_pipeline", _unexpected_run_book_pipeline)
    monkeypatch.setattr(provider_pipeline, "enable_job_log_capture", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(sys, "argv", ["run_provider_ocr.py", "--spec", str(spec_path)])

    provider_pipeline.main()

    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    summary_path = job_dirs.artifacts_dir / "pipeline_summary.json"
    source_pdf_path = job_dirs.source_dir / "downloaded.pdf"
    assert source_pdf_path.exists()
    assert normalized_json_path.exists()
    assert summary_path.exists()
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary_payload["source_pdf"] == str(source_pdf_path)
    normalized_payload = json.loads(normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["pages"][0]["blocks"][0]["text"] == "remote command pipeline smoke"
