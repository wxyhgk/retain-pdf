# Self-hosted PaddleX OCR + OpenRouter LLM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire retain-pdf-vi's OCR stage to a self-hosted PaddleX PP-StructureV3 server (via the existing `local_command` provider contract, reusing the built-in `paddle` document-schema adapter) and route the DeepSeek LLM calls through OpenRouter instead of DeepSeek's own API.

**Architecture:** A new standalone wrapper script bridges `local_command` to PaddleX's local `/layout-parsing` HTTP endpoint and writes the response `result` object as the raw OCR payload tagged `provider=paddle`, so the existing `paddle` adapter turns it into `document.v1.json` unmodified. The LLM switch is pure environment configuration — no code changes — because the DeepSeek transport is already a generic OpenAI-compatible `chat/completions` client with a configurable base URL.

**Tech Stack:** Python 3.11, `requests` (already pinned in `pyproject.toml`), `pytest`, existing `services.ocr_provider` / `services.document_schema` packages, Docker Compose env files.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-08-08-self-hosted-ocr-openrouter-llm-design.md`.
- No new third-party dependency: use `requests==2.32.5`, already declared in `pyproject.toml`.
- Python target: `>=3.11,<3.12` per `pyproject.toml`.
- Do not modify the translation stage, rendering stage, Rust job runner, or the `mineru` provider — out of scope per the spec.
- Do not add a new document-schema adapter — reuse the existing `paddle` adapter (`backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`) via `RETAIN_OCR_RAW_PROVIDER=paddle`.
- Follow the `local_command` plugin contract exactly as documented in `doc/api/03-OCR/04-local-command插件.md`: read `RETAIN_OCR_SOURCE_PDF` / `RETAIN_OCR_RAW_PAYLOAD_JSON` from env, exit 0 on success having written the raw payload, exit non-zero with a diagnosable stderr message on any failure.
- Tests run with `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests -q` (documented in `backend/scripts/runtime/pipeline/README.md`); new tests go under `backend/scripts/devtools/tests/document_schema/` next to the existing `paddle`/`local_command` tests.

---

### Task 1: Wrapper request/response pure functions

**Files:**
- Create: `backend/scripts/services/ocr_provider/local_paddlex_wrapper.py`
- Test: `backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py`

**Interfaces:**
- Produces: `PADDLEX_PIPELINE_MODEL: str` (constant, value `"PP-StructureV3"`)
- Produces: `build_request_payload(source_pdf_path: Path) -> dict[str, Any]`
- Produces: `extract_layout_result(response_json: dict[str, Any]) -> dict[str, Any]` (raises `RuntimeError` on envelope error or missing `layoutParsingResults`)

- [ ] **Step 1: Write the failing tests**

```python
# backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py
from __future__ import annotations

import base64
import sys
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.ocr_provider import local_paddlex_wrapper


def test_build_request_payload_embeds_base64_file_and_pp_structurev3_options(tmp_path: Path) -> None:
    pdf_path = tmp_path / "source.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\nfake pdf bytes\n")

    payload = local_paddlex_wrapper.build_request_payload(pdf_path)

    assert payload["fileType"] == 0
    assert base64.b64decode(payload["file"]) == pdf_path.read_bytes()
    assert payload["useTableRecognition"] is True
    assert payload["useFormulaRecognition"] is True


def test_extract_layout_result_returns_result_on_success() -> None:
    response_json = {
        "logId": "log-1",
        "errorCode": 0,
        "errorMsg": "Success",
        "result": {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}},
    }

    result = local_paddlex_wrapper.extract_layout_result(response_json)

    assert result == {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}}


def test_extract_layout_result_raises_on_error_envelope() -> None:
    response_json = {"logId": "log-2", "errorCode": 13, "errorMsg": "boom"}

    with pytest.raises(RuntimeError, match="boom"):
        local_paddlex_wrapper.extract_layout_result(response_json)


def test_extract_layout_result_raises_when_layout_results_missing() -> None:
    response_json = {"errorCode": 0, "errorMsg": "Success", "result": {"dataInfo": {}}}

    with pytest.raises(RuntimeError, match="layoutParsingResults"):
        local_paddlex_wrapper.extract_layout_result(response_json)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.ocr_provider.local_paddlex_wrapper'`

- [ ] **Step 3: Write the wrapper module (part 1: pure functions)**

```python
# backend/scripts/services/ocr_provider/local_paddlex_wrapper.py
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

import requests

from services.ocr_provider.paddle_api import build_optional_payload

PADDLEX_PIPELINE_MODEL = "PP-StructureV3"
PADDLEX_URL_ENV = "RETAIN_LOCAL_PADDLEX_URL"
PADDLEX_TIMEOUT_ENV = "RETAIN_LOCAL_PADDLEX_TIMEOUT_SECONDS"
DEFAULT_PADDLEX_URL = "http://localhost:8080"
DEFAULT_PADDLEX_TIMEOUT_SECONDS = 900.0


def build_request_payload(source_pdf_path: Path) -> dict[str, Any]:
    file_bytes = source_pdf_path.read_bytes()
    payload: dict[str, Any] = {
        "file": base64.b64encode(file_bytes).decode("ascii"),
        "fileType": 0,
    }
    payload.update(build_optional_payload(PADDLEX_PIPELINE_MODEL))
    return payload


def extract_layout_result(response_json: dict[str, Any]) -> dict[str, Any]:
    error_code = int(response_json.get("errorCode", 0) or 0)
    if error_code != 0:
        raise RuntimeError(
            f"PaddleX layout-parsing failed: code={error_code} "
            f"msg={response_json.get('errorMsg', '')} logId={response_json.get('logId', '')}"
        )
    result = response_json.get("result")
    if not isinstance(result, dict) or not isinstance(result.get("layoutParsingResults"), list):
        raise RuntimeError("PaddleX layout-parsing response missing result.layoutParsingResults")
    return result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/services/ocr_provider/local_paddlex_wrapper.py backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py
git commit -m "feat(ocr): add PaddleX request/response helpers for local_command wrapper"
```

---

### Task 2: Wrapper CLI entrypoint (`run` / `main`)

**Files:**
- Modify: `backend/scripts/services/ocr_provider/local_paddlex_wrapper.py`
- Test: `backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py`

**Interfaces:**
- Consumes: `build_request_payload(Path) -> dict`, `extract_layout_result(dict) -> dict` (Task 1)
- Produces: `run(source_pdf_path: Path, raw_payload_json_path: Path) -> None` (raises on failure)
- Produces: `main() -> int` (env-driven CLI entry, returns process exit code)

- [ ] **Step 1: Write the failing tests**

Append to `backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py`:

```python
import json


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
        self.status_code = status_code
        self._payload = payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")

    def json(self) -> dict[str, Any]:
        return self._payload


def test_run_writes_result_to_raw_payload_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pdf_path = tmp_path / "source.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\nfake\n")
    raw_payload_path = tmp_path / "ocr" / "local_raw" / "payload.json"
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: dict[str, Any], timeout: float):
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return _FakeResponse(
            200,
            {
                "errorCode": 0,
                "errorMsg": "Success",
                "result": {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}},
            },
        )

    monkeypatch.setattr(local_paddlex_wrapper.requests, "post", fake_post)
    monkeypatch.setenv(local_paddlex_wrapper.PADDLEX_URL_ENV, "http://paddlex.test:8080")

    local_paddlex_wrapper.run(pdf_path, raw_payload_path)

    assert captured["url"] == "http://paddlex.test:8080/layout-parsing"
    assert captured["timeout"] == local_paddlex_wrapper.DEFAULT_PADDLEX_TIMEOUT_SECONDS
    written = json.loads(raw_payload_path.read_text(encoding="utf-8"))
    assert written == {"layoutParsingResults": [{"prunedResult": {}}], "dataInfo": {}}


def test_main_returns_1_and_prints_stderr_on_missing_source_pdf_env(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("RETAIN_OCR_SOURCE_PDF", raising=False)
    monkeypatch.setenv("RETAIN_OCR_RAW_PAYLOAD_JSON", "/tmp/does-not-matter.json")

    exit_code = local_paddlex_wrapper.main()

    assert exit_code == 1
    assert "RETAIN_OCR_SOURCE_PDF" in capsys.readouterr().err


def test_main_returns_1_and_prints_stderr_on_http_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    pdf_path = tmp_path / "source.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\nfake\n")
    raw_payload_path = tmp_path / "payload.json"

    def fake_post(*_args, **_kwargs):
        return _FakeResponse(503, {})

    monkeypatch.setattr(local_paddlex_wrapper.requests, "post", fake_post)
    monkeypatch.setenv("RETAIN_OCR_SOURCE_PDF", str(pdf_path))
    monkeypatch.setenv("RETAIN_OCR_RAW_PAYLOAD_JSON", str(raw_payload_path))

    exit_code = local_paddlex_wrapper.main()

    assert exit_code == 1
    assert "503" in capsys.readouterr().err
    assert not raw_payload_path.exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py -v`
Expected: FAIL — `run` / `main` not defined.

- [ ] **Step 3: Add `run()` and `main()` to the wrapper module**

Append to `backend/scripts/services/ocr_provider/local_paddlex_wrapper.py`:

```python
def _paddlex_base_url() -> str:
    return (os.environ.get(PADDLEX_URL_ENV, "") or DEFAULT_PADDLEX_URL).strip().rstrip("/")


def _paddlex_timeout_seconds() -> float:
    raw = os.environ.get(PADDLEX_TIMEOUT_ENV, "").strip()
    if not raw:
        return DEFAULT_PADDLEX_TIMEOUT_SECONDS
    try:
        return float(raw)
    except ValueError:
        return DEFAULT_PADDLEX_TIMEOUT_SECONDS


def run(source_pdf_path: Path, raw_payload_json_path: Path) -> None:
    request_payload = build_request_payload(source_pdf_path)
    response = requests.post(
        f"{_paddlex_base_url()}/layout-parsing",
        json=request_payload,
        timeout=_paddlex_timeout_seconds(),
    )
    response.raise_for_status()
    result = extract_layout_result(response.json())
    raw_payload_json_path.parent.mkdir(parents=True, exist_ok=True)
    raw_payload_json_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    source_pdf = os.environ.get("RETAIN_OCR_SOURCE_PDF", "").strip()
    raw_payload_json = os.environ.get("RETAIN_OCR_RAW_PAYLOAD_JSON", "").strip()
    if not source_pdf:
        print("local_paddlex_wrapper: RETAIN_OCR_SOURCE_PDF is empty", file=sys.stderr)
        return 1
    if not raw_payload_json:
        print("local_paddlex_wrapper: RETAIN_OCR_RAW_PAYLOAD_JSON is empty", file=sys.stderr)
        return 1
    try:
        run(Path(source_pdf), Path(raw_payload_json))
    except Exception as exc:
        print(f"local_paddlex_wrapper: {exc}", file=sys.stderr)
        return 1
    print(f"local_paddlex_wrapper: wrote {raw_payload_json}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py -v`
Expected: PASS (7 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/services/ocr_provider/local_paddlex_wrapper.py backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper.py
git commit -m "feat(ocr): add local_command CLI entrypoint for self-hosted PaddleX wrapper"
```

---

### Task 3: End-to-end integration test through the real `paddle` adapter

**Files:**
- Test: `backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper_integration.py`

**Interfaces:**
- Consumes: `services.ocr_provider.local_command_driver.run_local_command_ocr_to_job_dir` (existing), `local_paddlex_wrapper.py` as a real subprocess (Tasks 1-2), `RETAIN_LOCAL_PADDLEX_URL` env var (Task 2)

This test proves the full chain: `local_command` driver → real wrapper script → stub PaddleX HTTP server → real `paddle` document-schema adapter → valid `document.v1.json`.

- [ ] **Step 1: Write the failing integration test**

```python
# backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper_integration.py
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper_integration.py -v`
Expected: FAIL initially with `ImportError` (if Tasks 1-2 weren't done) or a real assertion failure that pinpoints an adapter/schema mismatch. If it fails on an adapter assertion (not import), inspect the actual `normalized_json_path` content to see which field the real `paddle` adapter produced differently than assumed, and adjust the stub fixture's `parsing_res_list` fields to match — this is expected first-run TDD friction against a deep adapter chain, not a sign the design is wrong.

- [ ] **Step 3: Fix forward until the test passes**

No new production code is expected here — Tasks 1-2 already implement everything this test exercises. If the test fails, the fix is almost always adjusting the stub fixture in this test file to match the real `paddle` adapter's expectations (confirmed field names: `block_label`, `block_content`, `block_bbox`, `block_id`, `block_order`, `group_id`, `global_block_id`, `global_group_id`, `block_polygon_points` inside `prunedResult.parsing_res_list`, per `backend/scripts/services/document_schema/provider_adapters/paddle/block_reader.py` and the existing fixture at `backend/rust_api/src/ocr_provider/paddle/json_full.json`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper_integration.py -v`
Expected: PASS

- [ ] **Step 5: Run the full document_schema test directory to check for regressions**

Run: `PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema -q`
Expected: All tests PASS (no regressions in the `paddle` adapter or `local_command` driver tests)

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/devtools/tests/document_schema/test_local_paddlex_wrapper_integration.py
git commit -m "test(ocr): add end-to-end integration test for self-hosted PaddleX wrapper"
```

---

### Task 4: Wire the self-hosted OCR provider into deployment config

**Files:**
- Modify: `docker/delivery/docker/app.env`
- Modify: `docker/delivery/docker/web.env`

**Interfaces:**
- Consumes: `RETAIN_LOCAL_OCR_COMMAND`, `RETAIN_OCR_RAW_PROVIDER`, `RETAIN_LOCAL_PADDLEX_URL` (read by `local_command_driver.py` / `local_paddlex_wrapper.py`, Tasks 1-2)
- Consumes: `FRONT_OCR_PROVIDER` (read by `docker/entrypoint-web.sh`, existing)

- [ ] **Step 1: Add the local OCR command config to `docker/delivery/docker/app.env`**

Append to the end of `docker/delivery/docker/app.env`:

```
# 自托管 PaddleX OCR（PP-StructureV3 pipeline serving）
# 部署前需要单独启动: paddlex --serve --pipeline PP-StructureV3 --device gpu:0 --port 8080
RETAIN_LOCAL_OCR_COMMAND=python3 /app/backend/scripts/services/ocr_provider/local_paddlex_wrapper.py
RETAIN_OCR_RAW_PROVIDER=paddle
RETAIN_LOCAL_PADDLEX_URL=http://host.docker.internal:8080
```

- [ ] **Step 2: Point the frontend default OCR provider at `local` in `docker/delivery/docker/web.env`**

In `docker/delivery/docker/web.env`, change:

```
FRONT_OCR_PROVIDER=paddle
```

to:

```
FRONT_OCR_PROVIDER=local
```

- [ ] **Step 3: Verify both env files still parse correctly**

Run:

```bash
set -a
. docker/delivery/docker/app.env
. docker/delivery/docker/web.env
set +a
echo "$RETAIN_LOCAL_OCR_COMMAND"
echo "$RETAIN_OCR_RAW_PROVIDER"
echo "$RETAIN_LOCAL_PADDLEX_URL"
echo "$FRONT_OCR_PROVIDER"
```

Expected output (4 lines):
```
python3 /app/backend/scripts/services/ocr_provider/local_paddlex_wrapper.py
paddle
http://host.docker.internal:8080
local
```

- [ ] **Step 4: Commit**

```bash
git add docker/delivery/docker/app.env docker/delivery/docker/web.env
git commit -m "chore(docker): default OCR provider to self-hosted PaddleX local_command"
```

---

### Task 5: Route the LLM through OpenRouter

**Files:**
- Modify: `docker/delivery/docker/web.env`

**Interfaces:**
- Consumes: `FRONT_BASE_URL`, `FRONT_MODEL`, `FRONT_MODEL_API_KEY` (read by `docker/entrypoint-web.sh`, existing; forwarded to the browser runtime config, consumed by `services.translation.llm.providers.deepseek.transport` client-side)

- [ ] **Step 1: Update the LLM defaults in `docker/delivery/docker/web.env`**

Change:

```
FRONT_MODEL_API_KEY=
FRONT_MODEL=deepseek-v4-flash
FRONT_BASE_URL=https://api.deepseek.com/v1
```

to:

```
FRONT_MODEL_API_KEY=
FRONT_MODEL=deepseek/deepseek-chat
FRONT_BASE_URL=https://openrouter.ai/api/v1
```

Leave `FRONT_MODEL_API_KEY` empty in the committed template (matches the existing pattern for `FRONT_PADDLE_TOKEN` / `FRONT_MINERU_TOKEN` — secrets are filled in per-deployment, not committed). Before first real use, set it locally to an OpenRouter API key, and confirm the current DeepSeek model slug on openrouter.ai/models (`deepseek/deepseek-chat` is correct as of this plan's writing but OpenRouter slugs can change).

- [ ] **Step 2: Verify the env file parses correctly**

Run:

```bash
set -a
. docker/delivery/docker/web.env
set +a
echo "$FRONT_MODEL"
echo "$FRONT_BASE_URL"
```

Expected output (2 lines):
```
deepseek/deepseek-chat
https://openrouter.ai/api/v1
```

- [ ] **Step 3: Commit**

```bash
git add docker/delivery/docker/web.env
git commit -m "chore(docker): route DeepSeek LLM calls through OpenRouter by default"
```

---

### Task 6: Manual smoke test against a real self-hosted PaddleX server

**Files:** none (operational verification only — requires real GPU hardware, not automatable by a plan executor in this session)

**Interfaces:**
- Consumes: everything from Tasks 1-5

- [ ] **Step 1: Start PaddleX serving with the page-limit override**

```bash
pip install "paddlex[serving]"
paddlex --get_pipeline_config PP-StructureV3 --save_path ./pp_structurev3.yaml
```

Edit `./pp_structurev3.yaml` to remove the default 10-page cap (per `docs/version3.x/pipeline_usage/PP-StructureV3.md` in the PaddleOCR repo, the file field's page-limit note documents the config key to add for this).

```bash
paddlex --serve --pipeline ./pp_structurev3.yaml --device gpu:0 --port 8080
```

Confirm it prints `Uvicorn running on http://0.0.0.0:8080`.

- [ ] **Step 2: Run the retain-pdf-vi stack with the new env**

```bash
cd docker/delivery
docker compose up -d
```

Confirm `FRONT_OCR_PROVIDER=local` and the OpenRouter values from Task 5 are present in `docker/web.env` and `docker/app.env` before starting.

- [ ] **Step 3: Submit a short (<10 page) English paper through the web UI**

Confirm the job completes, and that the resulting translated PDF preserves headings, tables, and formulas (not just flattened body text) — this is the concrete signal that the `paddle` adapter reuse (Task 1-3) is working against real PaddleX output, not just the stub fixture.

- [ ] **Step 4: Submit a paper with more than 10 pages**

Confirm every page appears in the output. If pages are missing, the pipeline config page-limit override from Step 1 wasn't applied — fix the config and restart `paddlex --serve`.

- [ ] **Step 5: Confirm the translation stage completes via OpenRouter**

Check the job logs for the translation stage; confirm no authentication or `response_format` errors, and that the rendered PDF contains Vietnamese translated text.

- [ ] **Step 6: Record results**

If any step fails, capture the job's `logs/` directory contents before filing a follow-up — this plan's automated tests (Tasks 1-3) only prove the `local_command` → adapter wiring is correct against a stub; real PaddleX output shape or GPU-specific issues would surface only here.

---

## Self-Review Notes

- **Spec coverage:** OCR self-hosting via `local_command` + reused `paddle` adapter → Tasks 1-3. Page-limit trap → Tasks 4 (config comment) and 6 (manual verification). OpenRouter LLM switch → Task 5. Testing/verification plan from the spec → Tasks 1-3 (automated) and Task 6 (manual, since it requires real GPU hardware unavailable to an automated executor).
- **No new adapter code**: confirmed Tasks 1-3 only add the wrapper script and tests; `provider_adapters/paddle/` is untouched, matching the spec's Approach A.
- **Type/name consistency**: `local_paddlex_wrapper.PADDLEX_URL_ENV`, `.build_request_payload`, `.extract_layout_result`, `.run`, `.main` are used identically across Tasks 1, 2, and 3's integration test import.
