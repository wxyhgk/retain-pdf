from __future__ import annotations

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from types import SimpleNamespace

import fitz
import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from foundation.shared.job_dirs import ensure_job_dirs
from foundation.shared.job_dirs import resolve_job_dirs
from services.ocr_provider.local_command_driver import LOCAL_OCR_COMMAND_ENV
from services.ocr_provider.local_command_driver import LOCAL_OCR_RAW_PROVIDER_ENV
from services.ocr_provider.local_command_driver import run_local_command_ocr_to_job_dir
from services.ocr_provider.local_paddlex_wrapper import PADDLEX_URL_ENV

WRAPPER_SCRIPT = REPO_SCRIPTS_ROOT / "services" / "ocr_provider" / "local_paddlex_wrapper.py"

_STUB_LAYOUT_RESULT = {
    "layoutParsingResults": [
        {
            "prunedResult": {
                "page_count": 1,
                "width": 320,
                "height": 480,
                "model_settings": {},
                "parsing_res_list": [
                    {
                        "block_label": "body",
                        "block_content": "paddlex integration smoke text",
                        "block_bbox": [72, 60, 220, 90],
                        "block_id": 0,
                        "block_order": None,
                        "group_id": 0,
                        "global_block_id": 0,
                        "global_group_id": 0,
                        "block_polygon_points": [[72, 60], [220, 60], [220, 90], [72, 90]],
                    }
                ],
                "layout_det_res": {"boxes": []},
            },
            "markdown": {"text": "", "images": {}},
            "outputImages": {},
            "inputImage": "",
        }
    ],
    "preprocessedImages": [],
    "dataInfo": {"type": "pdf", "numPages": 1, "pages": [{"width": 320, "height": 480}]},
}


class _StubPaddleXHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler naming
        assert self.path == "/layout-parsing"
        length = int(self.headers.get("Content-Length", "0"))
        self.rfile.read(length)
        body = json.dumps(
            {"logId": "stub-log", "errorCode": 0, "errorMsg": "Success", "result": _STUB_LAYOUT_RESULT}
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args: object) -> None:  # silence default request logging
        pass


@pytest.fixture()
def stub_paddlex_server():
    server = HTTPServer(("127.0.0.1", 0), _StubPaddleXHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join(timeout=5)


def _write_source_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=320, height=480)
    page.insert_text((72, 72), "paddlex integration smoke")
    doc.save(path)
    doc.close()


def test_local_paddlex_wrapper_produces_valid_document_v1_via_paddle_adapter(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, stub_paddlex_server: str
) -> None:
    job_root = tmp_path / "20260808-local-paddlex-integration"
    job_dirs = resolve_job_dirs(job_root)
    ensure_job_dirs(job_dirs)
    source_pdf = job_dirs.source_dir / "book.pdf"
    _write_source_pdf(source_pdf)

    monkeypatch.setenv(LOCAL_OCR_COMMAND_ENV, f"{sys.executable} {WRAPPER_SCRIPT}")
    monkeypatch.setenv(LOCAL_OCR_RAW_PROVIDER_ENV, "paddle")
    monkeypatch.setenv(PADDLEX_URL_ENV, stub_paddlex_server)

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
    normalized_payload = json.loads(result.normalized_json_path.read_text(encoding="utf-8"))
    assert normalized_payload["source"]["provider"] == "paddle"
    assert normalized_payload["page_count"] == 1
    all_text = json.dumps(normalized_payload, ensure_ascii=False)
    assert "paddlex integration smoke text" in all_text
