import json
import sys
from pathlib import Path
from types import SimpleNamespace


from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.ocr.ocr_provider.local_command_driver import LOCAL_OCR_COMMAND_ENV
from retainpdf_pipeline.ocr.ocr_provider.local_command_driver import LOCAL_OCR_RAW_PROVIDER_ENV
from retainpdf_pipeline.ocr.ocr_provider.local_command_driver import run_local_command_ocr_to_job_dir
from devtools.tests.pdf_fixtures import write_pdf


def _write_source_pdf(path: Path) -> None:
    write_pdf(path, width=320, height=480, text="provider pipeline paddle smoke", at=(72, 72))


def test_local_command_ocr_driver_accepts_document_v1_output(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260606-local-ocr"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)
    script_path = tmp_path / "fake_local_ocr.py"
    script_path.write_text(
        """
import json
import os
from pathlib import Path

target = Path(os.environ["RETAIN_OCR_NORMALIZED_DOCUMENT_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "schema": "normalized_document_v1",
    "schema_version": "1.1",
    "document_id": "local-doc",
    "page_count": 1,
    "source": {"provider": "local"},
    "derived": {},
    "markers": {},
    "pages": [{
        "page_index": 0,
        "page": 1,
        "width": 320,
        "height": 480,
        "unit": "pt",
        "blocks": [{
            "block_id": "p001-b001",
            "page_index": 0,
            "order": 0,
            "type": "text",
            "sub_type": "body",
            "bbox": [72.0, 60.0, 220.0, 90.0],
            "text": "local ocr smoke",
            "geometry": {"bbox": [72.0, 60.0, 220.0, 90.0]},
            "content": {"kind": "text", "text": "local ocr smoke"},
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy": {"translate": True, "translate_reason": "body"},
            "provenance": {"provider": "local", "raw_label": "text", "raw_sub_type": "body", "raw_bbox": [72.0, 60.0, 220.0, 90.0], "raw_path": "$.blocks[0]"},
            "continuation_hint": {"source": "", "group_id": "", "role": "single", "scope": "", "reading_order": 0, "confidence": 0.0},
            "metadata": {},
            "source": {"provider": "local", "raw_type": "text"},
            "lines": [],
            "segments": []
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv(LOCAL_OCR_COMMAND_ENV, f"{sys.executable} {script_path}")

    result = run_local_command_ocr_to_job_dir(
        SimpleNamespace(
            file_path=str(source_pdf),
            job_root=str(job_dirs.root),
            source_dir=str(job_dirs.source_dir),
            ocr_dir=str(job_dirs.ocr_dir),
            translated_dir=str(job_dirs.translated_dir),
            rendered_dir=str(job_dirs.rendered_dir),
            artifacts_dir=str(job_dirs.artifacts_dir),
            logs_dir=str(job_dirs.logs_dir),
        )
    )

    assert result.source_pdf_path == source_pdf
    assert result.normalized_json_path.exists()
    assert result.provider_result_json_path.exists()
    assert result.artifact_manifest.normalized_json_path == result.normalized_json_path
    assert (job_dirs.ocr_dir / "normalized" / "document.v1.report.json").exists()
    normalized_payload = json.loads(result.normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "local"


def test_local_command_ocr_driver_accepts_raw_generic_payload(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260616-local-ocr-raw"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)
    script_path = tmp_path / "fake_local_raw_ocr.py"
    script_path.write_text(
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
        "unit": "pt",
        "blocks": [{
            "type": "text",
            "sub_type": "body",
            "bbox": [72.0, 60.0, 220.0, 90.0],
            "text": "local raw ocr smoke",
            "lines": [],
            "segments": []
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv(LOCAL_OCR_COMMAND_ENV, f"{sys.executable} {script_path}")
    monkeypatch.setenv(LOCAL_OCR_RAW_PROVIDER_ENV, "generic_flat_ocr")

    result = run_local_command_ocr_to_job_dir(
        SimpleNamespace(
            file_path=str(source_pdf),
            job_root=str(job_dirs.root),
            source_dir=str(job_dirs.source_dir),
            ocr_dir=str(job_dirs.ocr_dir),
            translated_dir=str(job_dirs.translated_dir),
            rendered_dir=str(job_dirs.rendered_dir),
            artifacts_dir=str(job_dirs.artifacts_dir),
            logs_dir=str(job_dirs.logs_dir),
        )
    )

    assert result.source_pdf_path == source_pdf
    assert result.normalized_json_path.exists()
    assert result.provider_result_json_path.exists()
    assert result.raw_main_payload_path == job_dirs.ocr_dir / "local_raw" / "payload.json"
    assert result.artifact_manifest.provider_raw_dir == job_dirs.ocr_dir / "local_raw"
    normalized_payload = json.loads(result.normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "generic_flat_ocr"
    assert normalized_payload["pages"][0]["blocks"][0]["text"] == "local raw ocr smoke"


def test_local_command_raw_provider_override_allows_adapter_mismatch(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260616-local-ocr-raw-mismatch"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)
    script_path = tmp_path / "fake_local_raw_mismatch.py"
    script_path.write_text(
        """
import json
import os
from pathlib import Path

target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "provider": "generic_flat_ocr",
    "pages": [{"width": 320, "height": 480, "blocks": []}]
}), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    seen: dict[str, object] = {}

    def _fake_adapt_path_to_document_v1_with_report(**kwargs):
        seen.update(kwargs)
        return (
            {
                "schema": "normalized_document_v1",
                "schema_version": "1.1",
                "document_id": kwargs["document_id"],
                "page_count": 0,
                "source": {"provider": kwargs["provider"]},
                "derived": {},
                "markers": {},
                "pages": [],
            },
            {
                "provider": kwargs["provider"],
                "detected_provider": "generic_flat_ocr",
                "provider_mismatch_allowed": kwargs.get("allow_provider_mismatch"),
            },
        )

    monkeypatch.setenv(LOCAL_OCR_COMMAND_ENV, f"{sys.executable} {script_path}")
    monkeypatch.setenv(LOCAL_OCR_RAW_PROVIDER_ENV, "custom_flat")
    monkeypatch.setattr(
        "retainpdf_pipeline.ocr.ocr_provider.local_command_driver.adapt_path_to_document_v1_with_report",
        _fake_adapt_path_to_document_v1_with_report,
    )

    result = run_local_command_ocr_to_job_dir(
        SimpleNamespace(
            file_path=str(source_pdf),
            job_root=str(job_dirs.root),
            source_dir=str(job_dirs.source_dir),
            ocr_dir=str(job_dirs.ocr_dir),
            translated_dir=str(job_dirs.translated_dir),
            rendered_dir=str(job_dirs.rendered_dir),
            artifacts_dir=str(job_dirs.artifacts_dir),
            logs_dir=str(job_dirs.logs_dir),
        )
    )

    assert result.normalized_json_path.exists()
    assert seen["provider"] == "custom_flat"
    assert seen["allow_provider_mismatch"] is True


def test_local_command_ocr_driver_accepts_command_from_args(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260616-local-ocr-args"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)
    script_path = tmp_path / "fake_local_raw_ocr_args.py"
    script_path.write_text(
        """
import json
import os
from pathlib import Path

target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "pages": [{
        "width": 320,
        "height": 480,
        "blocks": [{
            "type": "text",
            "bbox": [72.0, 60.0, 220.0, 90.0],
            "text": "local args ocr smoke"
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.delenv(LOCAL_OCR_COMMAND_ENV, raising=False)
    monkeypatch.delenv(LOCAL_OCR_RAW_PROVIDER_ENV, raising=False)

    result = run_local_command_ocr_to_job_dir(
        SimpleNamespace(
            provider="custom-local",
            local_ocr_command=f"{sys.executable} {script_path}",
            local_ocr_raw_provider="generic_flat_ocr",
            file_path=str(source_pdf),
            job_root=str(job_dirs.root),
            source_dir=str(job_dirs.source_dir),
            ocr_dir=str(job_dirs.ocr_dir),
            translated_dir=str(job_dirs.translated_dir),
            rendered_dir=str(job_dirs.rendered_dir),
            artifacts_dir=str(job_dirs.artifacts_dir),
            logs_dir=str(job_dirs.logs_dir),
        )
    )

    normalized_payload = json.loads(result.normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "generic_flat_ocr"
    assert normalized_payload["pages"][0]["blocks"][0]["text"] == "local args ocr smoke"


def test_command_ocr_driver_accepts_remote_source_url(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260616-remote-command-ocr"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    script_path = tmp_path / "fake_remote_command_ocr.py"
    script_path.write_text(
        """
import json
import os
from pathlib import Path

assert os.environ["RETAIN_OCR_PROVIDER"] == "remote-fast"
assert os.environ["RETAIN_OCR_PROVIDER_KIND"] == "remote_command"
assert os.environ["RETAIN_OCR_SOURCE_PDF"] == ""
assert os.environ["RETAIN_OCR_SOURCE_URL"] == "https://example.test/source.pdf"

target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
source_dir = Path(os.environ["RETAIN_OCR_SOURCE_DIR"])
source_dir.mkdir(parents=True, exist_ok=True)
# 远程命令要交出一份真的原文 PDF：归一化要按它的页面尺寸缩放坐标，渲染也要用它。
import fitz
with fitz.open() as pdf:
    pdf.new_page(width=320, height=480)
    pdf.save(str(source_dir / "remote-source.pdf"))
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
            "text": "remote command ocr smoke"
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.delenv(LOCAL_OCR_COMMAND_ENV, raising=False)
    monkeypatch.delenv(LOCAL_OCR_RAW_PROVIDER_ENV, raising=False)

    result = run_local_command_ocr_to_job_dir(
        SimpleNamespace(
            provider="remote-fast",
            ocr_provider_kind="remote_command",
            local_ocr_command=f"{sys.executable} {script_path}",
            local_ocr_raw_provider="generic_flat_ocr",
            file_path="",
            file_url="https://example.test/source.pdf",
            job_root=str(job_dirs.root),
            source_dir=str(job_dirs.source_dir),
            ocr_dir=str(job_dirs.ocr_dir),
            translated_dir=str(job_dirs.translated_dir),
            rendered_dir=str(job_dirs.rendered_dir),
            artifacts_dir=str(job_dirs.artifacts_dir),
            logs_dir=str(job_dirs.logs_dir),
        )
    )

    assert result.source_pdf_path == job_dirs.source_dir / "remote-source.pdf"
    normalized_payload = json.loads(result.normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "generic_flat_ocr"
    assert normalized_payload["pages"][0]["blocks"][0]["text"] == "remote command ocr smoke"


def test_raw_payload_from_a_command_is_scaled_to_the_source_pdf(tmp_path: Path, monkeypatch) -> None:
    """命令交回原始输出时，和正式的 normalize worker 一样缩放到原文 PDF（以前坐标留在 OCR 自己的单位里，却标着 pt）。"""
    job_root = tmp_path / "20261029-local-ocr-raw-scaled"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)  # 320 x 480 pt
    script_path = tmp_path / "fake_local_raw_pixels_ocr.py"
    script_path.write_text(
        """
import json
import os
from pathlib import Path

target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({
    "provider": "generic_flat_ocr",
    "pages": [{
        "width": 640,
        "height": 960,
        "unit": "pt",
        "blocks": [{
            "type": "text",
            "sub_type": "body",
            "bbox": [144.0, 120.0, 440.0, 180.0],
            "text": "rendered at twice the PDF size",
            "lines": [],
            "segments": []
        }]
    }]
}, ensure_ascii=False), encoding="utf-8")
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv(LOCAL_OCR_COMMAND_ENV, f"{sys.executable} {script_path}")
    monkeypatch.setenv(LOCAL_OCR_RAW_PROVIDER_ENV, "generic_flat_ocr")

    result = run_local_command_ocr_to_job_dir(
        SimpleNamespace(
            file_path=str(source_pdf),
            job_root=str(job_dirs.root),
            source_dir=str(job_dirs.source_dir),
            ocr_dir=str(job_dirs.ocr_dir),
            translated_dir=str(job_dirs.translated_dir),
            rendered_dir=str(job_dirs.rendered_dir),
            artifacts_dir=str(job_dirs.artifacts_dir),
            logs_dir=str(job_dirs.logs_dir),
        )
    )

    normalized = json.loads(result.normalized_json_path.read_text(encoding="utf-8"))
    page = normalized["pages"][0]
    assert (page["width"], page["height"]) == (320.0, 480.0)
    assert page["blocks"][0]["geometry"]["bbox"] == [72.0, 60.0, 220.0, 90.0]
    report = json.loads(result.normalized_report_json_path.read_text(encoding="utf-8"))
    assert report["validation"]["coordinate_space"] == "pdf_point"
