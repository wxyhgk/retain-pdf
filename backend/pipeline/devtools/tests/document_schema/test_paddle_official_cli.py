from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import fitz
import pytest


PIPELINE_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PIPELINE_ROOT))


from retainpdf_pipeline.ocr.ocr_provider import paddle_cli
from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.ocr.ocr_provider.paddle_cli import PaddleCliArtifacts
from retainpdf_pipeline.ocr.ocr_provider.paddle_cli import paddle_cli_payload_for_document_schema
from retainpdf_pipeline.ocr.ocr_provider.paddle_cli import run_paddle_cli
from retainpdf_pipeline.ocr.ocr_provider.paddle_runner import run_paddle_to_job_dir


def _write_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=320, height=480)
    page.insert_text((32, 48), "Paddle CLI smoke")
    doc.save(path)
    doc.close()


def _job_args(tmp_path: Path, source_pdf: Path, **overrides: object) -> SimpleNamespace:
    job_root = tmp_path / "paddle-cli-job"
    job_dirs = ensure_job_dirs(resolve_job_dirs(job_root))
    values: dict[str, object] = {
        "workflow": "ocr",
        "file_url": "",
        "file_path": str(source_pdf),
        "paddle_token": "",
        "paddle_api_url": "",
        "paddle_model": "PaddleOCR-VL-1.6",
        "page_ranges": "",
        "poll_interval": 1,
        "poll_timeout": 60,
        "disable_formula": False,
        "disable_table": False,
        "ocr_provider_options": {"transport": "official_cli"},
        "job_root": str(job_root),
        "source_dir": str(job_dirs.source_dir),
        "ocr_dir": str(job_dirs.ocr_dir),
        "translated_dir": str(job_dirs.translated_dir),
        "rendered_dir": str(job_dirs.rendered_dir),
        "artifacts_dir": str(job_dirs.artifacts_dir),
        "logs_dir": str(job_dirs.logs_dir),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _cli_artifacts(tmp_path: Path, payload: dict) -> PaddleCliArtifacts:
    run_dir = tmp_path / "cli-raw" / "run-1"
    resources = run_dir / "resources"
    resources.mkdir(parents=True)
    raw_path = run_dir / "result.json"
    raw_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    stdout = run_dir / "stdout.log"
    stderr = run_dir / "stderr.log"
    stdout.write_text("Result saved\n", encoding="utf-8")
    stderr.write_text("", encoding="utf-8")
    return PaddleCliArtifacts(
        payload=payload,
        raw_payload_path=raw_path,
        resources_dir=resources,
        stdout_path=stdout,
        stderr_path=stderr,
        model_type="doc_parsing",
    )


def test_cli_subprocess_is_bounded_and_keeps_token_out_of_argv(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source_pdf = tmp_path / "source.pdf"
    _write_pdf(source_pdf)
    captured: dict[str, object] = {}

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        captured["command"] = command
        captured["kwargs"] = kwargs
        output_path = Path(command[command.index("--output") + 1])
        output_path.write_text(
            json.dumps({"jobId": "cli-job", "pages": [{"markdownText": "# Hello"}]}),
            encoding="utf-8",
        )
        return SimpleNamespace(returncode=0, stdout="saved\n", stderr="")

    monkeypatch.setattr(paddle_cli, "_resolve_executable", lambda: "/opt/tools/paddleocr")
    monkeypatch.setattr(paddle_cli.subprocess, "run", fake_run)
    args = SimpleNamespace(
        paddle_api_url="",
        page_ranges="2,4-5",
        poll_timeout=45,
        disable_formula=True,
        disable_table=True,
        ocr_provider_options={
            "transport": "official_cli",
            "cli_request_timeout": 12,
            "cli_timeout": 80,
        },
    )

    artifacts = run_paddle_cli(
        args=args,
        source_pdf_path=source_pdf,
        token="super-secret-token",
        model_name="PaddleOCR-VL-1.6",
        raw_root=tmp_path / "raw",
    )

    command = captured["command"]
    kwargs = captured["kwargs"]
    assert isinstance(command, list)
    assert "super-secret-token" not in command
    assert command[:4] == ["/opt/tools/paddleocr", "api", "--model_type", "doc_parsing"]
    assert command[command.index("--page_ranges") + 1] == "2,4-5"
    assert command[command.index("--use_formula_recognition") + 1] == "False"
    assert kwargs["shell"] is False
    assert kwargs["timeout"] == 80.0
    assert kwargs["env"]["PADDLEOCR_ACCESS_TOKEN"] == "super-secret-token"
    assert artifacts.payload["jobId"] == "cli-job"
    assert artifacts.raw_payload_path.is_file()
    assert artifacts.resources_dir.is_dir()


def test_cli_timeout_is_reported_without_token(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source_pdf = tmp_path / "source.pdf"
    _write_pdf(source_pdf)
    monkeypatch.setattr(paddle_cli, "_resolve_executable", lambda: "/opt/tools/paddleocr")

    def timed_out(*_args: object, **_kwargs: object) -> None:
        raise subprocess.TimeoutExpired("paddleocr", 5, output="partial", stderr="stalled")

    monkeypatch.setattr(paddle_cli.subprocess, "run", timed_out)
    with pytest.raises(RuntimeError, match=r"timed out after 5s") as exc_info:
        run_paddle_cli(
            args=SimpleNamespace(
                paddle_api_url="",
                page_ranges="",
                poll_timeout=2,
                disable_formula=False,
                disable_table=False,
                ocr_provider_options={"cli_request_timeout": 1, "cli_timeout": 5},
            ),
            source_pdf_path=source_pdf,
            token="secret-not-in-error",
            model_name="PaddleOCR-VL-1.6",
            raw_root=tmp_path / "raw",
        )
    assert "secret-not-in-error" not in str(exc_info.value)
    run_dir = next((tmp_path / "raw").iterdir())
    assert (run_dir / "stdout.log").read_text(encoding="utf-8") == "partial"
    assert (run_dir / "stderr.log").read_text(encoding="utf-8") == "stalled"


def test_cli_ocr_result_keeps_real_line_bboxes_for_document_adapter(tmp_path: Path) -> None:
    artifacts = _cli_artifacts(
        tmp_path,
        {
            "jobId": "ocr-job",
            "pages": [
                {
                    "prunedResult": {
                        "input_img_shape": [960, 640, 3],
                        "rec_texts": ["first line", "second line"],
                        "rec_scores": [0.99, 0.95],
                        "rec_boxes": [[20, 30, 200, 60], [22, 80, 240, 115]],
                    }
                }
            ],
        },
    )
    artifacts = PaddleCliArtifacts(**{**artifacts.__dict__, "model_type": "ocr"})

    payload = paddle_cli_payload_for_document_schema(
        artifacts=artifacts,
        pdf_page_sizes=[(320.0, 480.0)],
    )

    page = payload["layoutParsingResults"][0]
    assert page["prunedResult"]["width"] == 640.0
    assert page["prunedResult"]["height"] == 960.0
    assert [block["block_bbox"] for block in page["prunedResult"]["parsing_res_list"]] == [
        [20.0, 30.0, 200.0, 60.0],
        [22.0, 80.0, 240.0, 115.0],
    ]
    assert payload["_meta"]["cliGeometryPrecision"] == "block_bbox"


def test_cli_doc_parsing_runs_ocr_only_entry_and_marks_page_level_geometry(
    tmp_path: Path,
) -> None:
    source_pdf = tmp_path / "source.pdf"
    _write_pdf(source_pdf)
    cli_payload = {
        "jobId": "doc-job",
        "pages": [
            {
                "markdownText": "# Hello\n\nPage-level Markdown.",
                "markdownImages": {},
                "outputImages": {},
                "futureCliField": {"preserved": True},
            }
        ],
    }
    artifacts = _cli_artifacts(tmp_path, cli_payload)
    args = _job_args(tmp_path, source_pdf)

    _job_root, _source, provider_json, normalized_json = run_paddle_to_job_dir(
        args,
        download_source_pdf=lambda *_args: source_pdf,
        get_token=lambda **_kwargs: "token",
        submit_remote=lambda **_kwargs: pytest.fail("HTTP submit must not run"),
        submit_local=lambda **_kwargs: pytest.fail("HTTP submit must not run"),
        poll_until_complete=lambda **_kwargs: pytest.fail("HTTP poll must not run"),
        download_jsonl=lambda **_kwargs: pytest.fail("HTTP download must not run"),
        run_cli=lambda **_kwargs: artifacts,
    )

    provider_payload = json.loads(provider_json.read_text(encoding="utf-8"))
    document = json.loads(normalized_json.read_text(encoding="utf-8"))
    report = json.loads(normalized_json.with_name("document.v1.report.json").read_text(encoding="utf-8"))
    assert cli_payload == json.loads(artifacts.raw_payload_path.read_text(encoding="utf-8"))
    assert provider_payload["layoutParsingResults"][0]["futureCliField"] == {"preserved": True}
    assert provider_payload["_meta"]["transport"] == "official_cli"
    assert document["page_count"] == 1
    assert document["pages"][0]["metadata"]["geometry_precision"] == "page_bbox"
    assert document["pages"][0]["blocks"][0]["metadata"]["provider_geometry_precision"] == "page_bbox"
    assert report["transport"] == "official_cli"
    assert report["geometry_precision"] == "page_bbox"
    assert report["validation"]["valid"] is True
    assert report["validation"]["complete"] is False
    assert report["complete"] is False
    assert any("omits prunedResult/bbox" in warning for warning in report["warnings"])
    assert (Path(args.job_root) / "md" / "full.md").read_text(encoding="utf-8").startswith("# Hello")


def test_cli_transport_rejects_book_workflow_before_subprocess(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    _write_pdf(source_pdf)
    args = _job_args(tmp_path, source_pdf, workflow="book")
    with pytest.raises(RuntimeError, match="limited to the OCR-only workflow"):
        run_paddle_to_job_dir(
            args,
            download_source_pdf=lambda *_args: source_pdf,
            get_token=lambda **_kwargs: "token",
            run_cli=lambda **_kwargs: pytest.fail("CLI must not run for book workflow"),
        )
