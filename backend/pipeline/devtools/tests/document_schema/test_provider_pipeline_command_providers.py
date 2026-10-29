"""provider pipeline 发现并调用配置出来的命令型 OCR provider（本地命令 / 远程命令），以及 OCR-only 工作流在归一化后停下。

从 test_provider_pipeline_entry.py 整块拆出，用例本身未改。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.ocr.ocr_provider import provider_pipeline
from devtools.tests.pdf_fixtures import write_pdf


def _write_source_pdf(path: Path) -> None:
    write_pdf(path, width=320, height=480, text="provider pipeline paddle smoke", at=(72, 72))


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
                    "model": "deepseek-flash",
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
                    "options": {},
                },
                "translation": {"credential_ref": "", "glossary_entries": []},
                "render": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # 本地 OCR 的命令只认服务器配置（环境变量 / ocr_providers.json），不认 stage spec 里的 options.command
    # （审计 A2，2026-10-22，见 test_local_command_server_owned.py）。
    monkeypatch.setenv("RETAIN_LOCAL_OCR_COMMAND", f"{sys.executable} {local_script}")
    monkeypatch.setenv("RETAIN_OCR_RAW_PROVIDER", "generic_flat_ocr")

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
# 远程命令要交出一份真的原文 PDF：归一化要按它的页面尺寸缩放坐标，渲染也要用它。
import fitz
with fitz.open() as pdf:
    pdf.new_page(width=320, height=480)
    pdf.save(str(source_dir / "downloaded.pdf"))

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
