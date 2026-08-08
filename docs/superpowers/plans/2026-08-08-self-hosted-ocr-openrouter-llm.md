# Self-hosted PaddleX OCR + OpenRouter LLM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire retain-pdf-vi's OCR stage to a self-hosted PaddleX PP-StructureV3 server (via the existing `local_command` provider contract, reusing the built-in `paddle` document-schema adapter) and route the DeepSeek LLM calls through OpenRouter instead of DeepSeek's own API.

**Architecture:** A new standalone wrapper script bridges `local_command` to PaddleX's local `/layout-parsing` HTTP endpoint and writes the response `result` object as the raw OCR payload tagged `provider=paddle`, so the existing `paddle` adapter turns it into `document.v1.json` unmodified. The LLM switch is pure environment configuration — no code changes — because the DeepSeek transport is already a generic OpenAI-compatible `chat/completions` client with a configurable base URL.

**Tech Stack:** Python 3.11, `requests` (already pinned in `pyproject.toml`), `pytest`, existing `services.ocr_provider` / `services.document_schema` packages, Docker Compose env files.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-08-08-self-hosted-ocr-openrouter-llm-design.md`.
- No new third-party dependency: use `requests==2.32.5`, already declared in `pyproject.toml`.
- Python target: `>=3.11,<3.12` per `pyproject.toml`.
- Do not modify the translation stage, rendering stage, or the `mineru` provider — out of scope per the spec. (Amended 2026-08-08 after final review: the Rust job-request layer and the frontend OCR-provider UI are now in scope for Tasks 7-8 only, narrowly, to fix two Critical bugs the final whole-branch review found — see those tasks for exact scope.)
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

### Task 7: Fix `RETAIN_OCR_RAW_PROVIDER` precedence for the `local` provider

**Why (added after final review):** The final whole-branch review found that `RETAIN_OCR_RAW_PROVIDER=paddle` (set in Task 4) is dead configuration in production. The Rust job-request layer (`backend/rust_api/src/worker_command/stage_specs.rs:314-333`, `provider_options_for_stage`) eagerly bakes every non-null provider option default from `ocr_provider_definitions()` into the written stage spec, *before* the job ever reaches the Python `local_command_driver.py`. Since `ocr_providers.json`'s `local.options.raw_provider.default` is `"generic_flat_ocr"` (not empty), the stage spec always carries `raw_provider="generic_flat_ocr"`, and `local_command_driver.py`'s `_configured_text()` (`backend/scripts/services/ocr_provider/local_command_driver.py:191-202`) checks `args.local_ocr_raw_provider` *before* the `RETAIN_OCR_RAW_PROVIDER` env var — so the env var set in `app.env` never gets consulted. The failure is silent: the payload gets routed through `generic_flat_ocr` instead of `paddle`, producing a valid-but-empty (0-page) `document.v1.json` with no error. There is a second copy of the same wrong default compiled into the Rust binary at `backend/rust_api/src/ocr_provider/provider_config.rs`'s `legacy_provider_definitions()` (used when `backend/config/ocr_providers.json` isn't present at runtime, e.g. the current `docker/Dockerfile.app` doesn't copy `backend/config/` into the image) — both copies must change together, plus the Python-side fallback for consistency.

The fix restores the documented precedence order (`doc/api/03-OCR/04-local-command插件.md:75-79`: request options → JSON config default → env var) by making the JSON-config-level default empty, so it's no longer treated as "set" and the env var becomes reachable again. This does not change behavior for any other provider or any deployment that already explicitly configures `raw_provider` (via `ocr_options` in the job request, or via a non-empty entry in `ocr_providers.json`).

**Files:**
- Modify: `backend/config/ocr_providers.json`
- Modify: `backend/rust_api/src/ocr_provider/provider_config.rs`
- Modify: `backend/rust_api/src/ocr_provider/catalog.rs` (add test)
- Modify: `backend/scripts/foundation/shared/ocr_provider_config.py`

**Interfaces:**
- Consumes: nothing new — this is a data-only fix to existing config/fallback structures.
- Produces: `local.options.raw_provider.default == ""` everywhere it's defined, so `RETAIN_OCR_RAW_PROVIDER` (set in `app.env` by Task 4) actually takes effect.

- [ ] **Step 1: Change the JSON config default**

In `backend/config/ocr_providers.json`, inside `providers.local.options.raw_provider`, change:

```json
        "raw_provider": {
          "type": "string",
          "env": "RETAIN_OCR_RAW_PROVIDER",
          "default": "generic_flat_ocr"
        }
```

to:

```json
        "raw_provider": {
          "type": "string",
          "env": "RETAIN_OCR_RAW_PROVIDER",
          "default": ""
        }
```

- [ ] **Step 2: Change the Rust compiled-in fallback default**

In `backend/rust_api/src/ocr_provider/provider_config.rs`, inside `legacy_provider_definitions()`, find the `"local"` block:

```rust
    providers.insert(
        "local".to_string(),
        serde_json::json!({
            "display_name": "Local OCR",
            "kind": "local_command",
            "credential": null,
            "options": {
                "command": {"type": "string", "env": "RETAIN_LOCAL_OCR_COMMAND", "default": ""},
                "raw_provider": {"type": "string", "env": "RETAIN_OCR_RAW_PROVIDER", "default": "generic_flat_ocr"}
            }
        }),
    );
```

Change the `raw_provider` default to `""`:

```rust
    providers.insert(
        "local".to_string(),
        serde_json::json!({
            "display_name": "Local OCR",
            "kind": "local_command",
            "credential": null,
            "options": {
                "command": {"type": "string", "env": "RETAIN_LOCAL_OCR_COMMAND", "default": ""},
                "raw_provider": {"type": "string", "env": "RETAIN_OCR_RAW_PROVIDER", "default": ""}
            }
        }),
    );
```

- [ ] **Step 3: Change the Python compiled-in fallback default**

In `backend/scripts/foundation/shared/ocr_provider_config.py`, inside `_legacy_provider_definitions()`, find the `"local"` block's `raw_provider` option and change its `"default"` value from `"generic_flat_ocr"` to `""`, matching the same edit made in Steps 1-2.

- [ ] **Step 4: Add a Rust test proving the fix**

In `backend/rust_api/src/ocr_provider/catalog.rs`, inside `mod tests`, add (near `provider_public_definitions_expose_credentials_and_options`):

```rust
    #[test]
    fn local_provider_raw_provider_default_is_empty_so_env_var_precedence_applies() {
        let definitions = provider_public_definitions();
        let local = definitions
            .iter()
            .find(|definition| definition.key == "local")
            .expect("local public definition");
        assert_eq!(
            local
                .options
                .get("raw_provider")
                .map(|option| option.default.as_str()),
            Some(Some(""))
        );
    }
```

(Note: `option.default` is `serde_json::Value`; `.as_str()` returns `Option<&str>`, so the assertion compares against `Some(Some(""))` — a `Value::String("")` case, distinct from `Value::Null`. If this doesn't compile as written, adjust to match the actual `Value` variant produced — the requirement is that the default is the empty string, not null and not `"generic_flat_ocr"`.)

- [ ] **Step 5: Run the Rust test suite to verify no regressions and the new test passes**

Run: `cd backend/rust_api && cargo test -q`
Expected: all tests pass, including the new `local_provider_raw_provider_default_is_empty_so_env_var_precedence_applies`.

- [ ] **Step 6: Run the Python test suite to verify no regressions**

Run: `PYTHONPATH=backend/scripts /home/thuandn/miniconda3/envs/retain-pdf-vi/bin/python -m pytest backend/scripts/devtools/tests/document_schema -q`
Expected: same pass/fail counts as this plan's established baseline (pre-existing `DEEPSEEK_API_KEY`-related failures aside) — no new failures caused by the config default change. `test_ocr_provider_registry.py`'s tests use their own inline fixture (not `backend/config/ocr_providers.json`), so they are unaffected by this change.

- [ ] **Step 7: Commit**

```bash
git add backend/config/ocr_providers.json backend/rust_api/src/ocr_provider/provider_config.rs backend/rust_api/src/ocr_provider/catalog.rs backend/scripts/foundation/shared/ocr_provider_config.py
git commit -m "fix(ocr): stop local provider's raw_provider default from shadowing RETAIN_OCR_RAW_PROVIDER"
```

---

### Task 8: Make the self-hosted `local` OCR provider selectable in the web UI

**Why (added after final review):** The final whole-branch review found that `FRONT_OCR_PROVIDER=local` (set in Task 4) is silently discarded by the frontend. `frontend/src/js/config/providers.ts` hardcodes `OCR_PROVIDER_DEFINITIONS` to a single `"paddle"` entry, and `normalizeOcrProvider()` falls back to `DEFAULT_OCR_PROVIDER` (`"paddle"`) for any id not in that list — so every job submission from the web UI is sent with `provider: "paddle"` regardless of the env default. The Rust `GET /api/v1/providers/ocr` endpoint (which does read the dynamic provider list) is never called by any frontend code — confirmed by grepping `frontend/src` and `frontend-react/src` for `providers/ocr` (zero matches). `frontend/src/pages/home/composition/external.ts` re-exports `OCR_PROVIDER_DEFINITIONS` from this same `frontend/src/js/config/providers.ts` file, so it is the single source of truth for both the legacy and React UI trees — one file to fix.

**Files:**
- Modify: `frontend/src/js/config/providers.ts`
- Test: check `frontend/tests/` for an existing test file covering `OCR_PROVIDER_DEFINITIONS` / `normalizeOcrProvider` / `getOcrProviderDefinition`; add a test there if one exists, or create `frontend/tests/providers.test.mjs` following the existing test file conventions in that directory if none does.

**Interfaces:**
- Consumes: nothing new.
- Produces: `OCR_PROVIDER_DEFINITIONS` now contains a `"local"` entry; `normalizeOcrProvider("local")` returns `"local"` instead of falling back to `"paddle"`.

- [ ] **Step 1: Add a `local` entry to `OCR_PROVIDER_DEFINITIONS`**

In `frontend/src/js/config/providers.ts`, add a second entry to the `OCR_PROVIDER_DEFINITIONS` array (after the existing `"paddle"` entry):

```javascript
  {
    id: "local",
    label: "自托管 OCR",
    description: "本地 / 自托管 OCR（local_command），无需在此填写凭据。",
    tokenField: "local_token",
    runtimeConfigKey: "localToken",
    tokenLabel: "",
    tokenPlaceholder: "本地 OCR 无需凭据",
    validationButtonLabel: "",
    validationIdleMessage: "",
    validationMissingMessage: "",
    validationUnavailableMessage: "",
    docsUrl: "",
    docsLabel: "",
    supportsValidation: false,
  },
```

This matches the existing `"paddle"` entry's shape exactly (so `OcrProviderPanels.tsx` and `payload.ts` — which read `tokenField`, `tokenPlaceholder`, `docsUrl`, `docsLabel`, `supportsValidation` — render/behave correctly without needing changes to either of those files). `supportsValidation: false` hides the validate button per `OcrProviderPanels.tsx:80-89`. `tokenField: "local_token"` gives `payload.ts:89`'s `payload[definition.tokenField] = ocrToken || ""` a harmless, unused key to write to, since the `local` provider's `credential` is `null` server-side and ignores it.

- [ ] **Step 2: Run any existing frontend provider-related tests**

Run: `cd frontend && grep -rl "OCR_PROVIDER_DEFINITIONS\|normalizeOcrProvider\|getOcrProviderDefinition" tests/ 2>/dev/null`

If this finds an existing test file, read it, add a case asserting `normalizeOcrProvider("local") === "local"` and that `getOcrProviderDefinition("local").id === "local"`, following that file's existing style and test runner (check `package.json`'s `"scripts"` for the test command — likely `node --test` or similar given `.mjs` test files elsewhere in this repo's Python tests; use whatever this frontend actually uses, found via `cat frontend/package.json`).

If no existing test file covers this module, add a minimal one at `frontend/tests/providers.test.mjs` (following the naming/structure of whatever other `.test.mjs` files already exist in `frontend/tests/`) with exactly these two assertions, and wire it into whatever command `npm test` (or equivalent) already runs in this repo.

- [ ] **Step 3: Run the frontend test suite to verify no regressions**

Run: `cd frontend && npm test` (or the exact test command found in Step 2 — use what the repo actually has, not a guessed command)
Expected: all tests pass, including the new provider test.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/js/config/providers.ts frontend/tests/
git commit -m "fix(frontend): register local OCR provider so FRONT_OCR_PROVIDER=local is selectable"
```

---

### Task 9: Make the `local` OCR provider actually usable end-to-end from the web UI

**Why (added after final review round 2):** Task 8 fixed `normalizeOcrProvider("local")`, but a second review round found the web UI still cannot use the `local` provider, for three independent, stacked reasons — fixing any one alone just relocates the failure to the next:

1. **Boot-time seeding never reads the env default.** `frontend/src/js/config/persisted-config.ts`'s `loadBrowserStoredConfig()` calls `normalizeBrowserStoredConfig(readBrowserStoredConfig())` (`frontend/src/js/config/storage.ts:75-84`). With empty localStorage (fresh browser), `readBrowserStoredConfig()` returns `{}`, so `source.ocrProvider` is `undefined`, and `normalizeOcrProvider(undefined)` (`frontend/src/js/config/providers.ts`) falls back to the hardcoded `DEFAULT_OCR_PROVIDER = "paddle"` — never consulting `defaultOcrProvider()` (`frontend/src/js/config/runtime.ts:131`), which is the function that actually reads `FRONT_OCR_PROVIDER` (via `window.__FRONT_RUNTIME_CONFIG__.ocrProvider`). So `FRONT_OCR_PROVIDER=local` never reaches the app's initial state at all.
2. **The credential-readiness gate is hardcoded to `paddleToken`.** `frontend/src/js/features/credentials/state.ts`'s `ocrTokenFromCredentials(credentials, { defaultPaddleToken })` reads only `credentials.paddleToken`, ignoring which provider is active. `hasCompleteCredentials()` and `ensureOcrCredentialValidationReady()` (`frontend/src/js/features/credentials/ocr-readiness-flow.ts`) both route through it, so the submit flow blocks with `status: "missing_token"` for the `local` provider even though it needs no credential (`supportsValidation: false`, set in Task 8).
3. **The submitted payload would carry a field the backend rejects.** `frontend/src/js/features/workflow/payload.ts`'s `buildOcrPayload()` unconditionally sets `payload[definition.tokenField] = ocrToken || ""` (line 89) — for `local` that's `local_token`, an unrecognized field. `backend/rust_api/src/models/input/ocr.rs` has `#[serde(deny_unknown_fields)]` on `OcrInput`, so once (1) and (2) are fixed, submission would 400.

**Files:**
- Modify: `frontend/src/js/config/persisted-config.ts`
- Modify: `frontend/src/js/features/credentials/state.ts`
- Modify: `frontend/src/js/features/credentials/ocr-readiness-flow.ts`
- Modify: `frontend/src/js/features/workflow/payload.ts`
- Test: extend/add to whatever existing test files in `frontend/tests/` already cover `persisted-config`, `credentials/state`, and `workflow/payload` (discover exact filenames the same way Task 8 did — `grep -rl` for the function names in `frontend/tests/`)

**Interfaces:**
- Consumes: `getOcrProviderDefinition(providerId)` and the `supportsValidation` field on each `OCR_PROVIDER_DEFINITIONS` entry (already present from Task 8) — this is the signal to use for "does this provider need a credential," not a new flag.
- Produces: no new exported names; existing functions change behavior as described below.

- [ ] **Step 1: Fix boot-time provider seeding in `loadBrowserStoredConfig()`**

In `frontend/src/js/config/persisted-config.ts`, import `defaultOcrProvider` from `./runtime.js` (safe — `runtime.ts` only imports from `model-constants.js` and `providers.js`, no circular risk) and change `loadBrowserStoredConfig()` so that when the raw stored payload has no `ocrProvider` key at all, it seeds from `defaultOcrProvider()` instead of letting `normalizeBrowserStoredConfig` silently fall back to the hardcoded `DEFAULT_OCR_PROVIDER`. A previously-saved explicit choice (even `"paddle"`) must still be respected — only the "never saved anything" case should pick up the env default. Apply the same seeded value in both the desktop-mode and non-desktop-mode return paths of the function.

- [ ] **Step 2: Skip the credential requirement for providers that don't need one**

In `frontend/src/js/features/credentials/state.ts`, change `ocrTokenFromCredentials` and/or `hasCompleteCredentials` so that when `getOcrProviderDefinition(providerId).supportsValidation` is `false`, no token is required (treat the gate as satisfied without needing a token value). You will need to thread `providerId` through to wherever these are called if it isn't already available in scope — check call sites in `frontend/src/js/features/credentials/selectors-port.ts` and `frontend/src/js/features/credentials/ocr-readiness-flow.ts`.

In `frontend/src/js/features/credentials/ocr-readiness-flow.ts`'s `ensureOcrCredentialValidationReady`, add an early return before the `if (!token)` check: when `!definition.supportsValidation`, return `{ ok: true, status: "not_required", definition, token: "", result: null }` (or equivalent — match whatever shape the existing `ok: true` returns use, e.g. the `"cached"` branch just below it).

Also check `frontend/src/pages/home/features/credentials/credentials-view-store.ts` (around line 141, the `elements()` function's `paddleInput: elementsRef.tokenInputs.paddle || null`) and whatever save-flow function reads `elements().paddleInput.value` to persist the token — confirm this doesn't throw or misbehave for a provider with no visible/required token input. `elementsRef.tokenInputs` is already a generic per-provider map (`tokenInputRef(providerId)` in the same file already stores into it correctly per-provider), so this is likely just a legacy accessor read by the save path; trace its consumer(s) and fix only if you find an actual bug (e.g. it throwing on `null`, or blocking save for `local`). Don't do unrelated refactoring here — this codebase is mid-migration between a legacy vanilla-JS credentials system and a newer per-provider one, and the fix should be the minimal change that makes `local` work, not a cleanup pass.

- [ ] **Step 3: Stop sending a token field the backend doesn't recognize**

In `frontend/src/js/features/workflow/payload.ts`'s `buildOcrPayload()`, change the payload construction so `payload[definition.tokenField] = ocrToken || ""` is only set when `definition.supportsValidation` is `true`. For `local`, the payload should have no `local_token` key at all.

- [ ] **Step 4: Write one end-to-end test tying all three fixes together**

This is the acceptance criterion the final review specifically called for — a single test proving the whole chain, not three isolated unit tests that could each individually pass while the seam between them stays broken (this is exactly the shape of bug that slipped through Task 8's own review). Using whatever test file(s) you extended in Step 1-3 (or a new one if none fits), write a test that:
1. Simulates a fresh boot with no persisted browser config and `runtimeConfig.ocrProvider` (or the equivalent test seam — check how existing tests mock `window.__FRONT_RUNTIME_CONFIG__` or the `runtime.js` module, e.g. via `frontend/tests/workflow-payload.test.mjs`'s conventions if it mocks similar things) set to `"local"`.
2. Asserts the resulting effective OCR provider is `"local"`.
3. Asserts `hasCompleteCredentials`/the readiness gate reports ready without any token being set.
4. Asserts `buildOcrPayload({ ocrProvider: "local", ocrToken: "", ... })` produces a payload object with `provider: "local"` and no `local_token` (or any token) key.

- [ ] **Step 5: Run the frontend test suite**

Run: `cd frontend && npm test`
Expected: all tests pass, including the new ones from Step 4, with the same 2 pre-existing CSS-ratchet failures as the baseline (confirm they're the same two, not new ones).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/js/config/persisted-config.ts frontend/src/js/features/credentials/state.ts frontend/src/js/features/credentials/ocr-readiness-flow.ts frontend/src/js/features/workflow/payload.ts frontend/tests/
git commit -m "fix(frontend): make local OCR provider selectable, credential-free, and submittable end-to-end"
```

(If Step 2 required a change to `credentials-view-store.ts`, add that file to the commit too.)

---

### Task 10: Fix deployment-config Important findings (Linux Docker networking, page-limit trap, undocumented timeout)

**Why (added after final review round 2):** Three Important findings from the first review round were never addressed by Tasks 7-8, which were scoped only to the two Critical bugs:

1. `docker/delivery/docker-compose.yml`'s `app` service has no `extra_hosts`, so `RETAIN_LOCAL_PADDLEX_URL=http://host.docker.internal:8080` (set in `app.env` by Task 4) fails DNS resolution on native Linux Docker — the most likely host for a self-hosted GPU PaddleX box. Docker has supported `host-gateway` as the resolution target since 20.10.
2. `docker/delivery/docker/app.env`'s comment tells operators to run `paddlex --serve --pipeline PP-StructureV3 ...` — the stock pipeline, which caps at 10 pages by default. The design spec explicitly calls this a "silent-truncation trap" and specifies the two-step `--get_pipeline_config` + edit + `--pipeline <path>` form, but the comment never got updated to match.
3. `local_paddlex_wrapper.py`'s `RETAIN_LOCAL_PADDLEX_TIMEOUT_SECONDS` (default 900s) is not documented anywhere in `app.env`, so an operator who raises the outer `RETAIN_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS` (default 1800s) for a long paper still hits a silent 900s wall from the inner HTTP request first.

**Files:**
- Modify: `docker/delivery/docker-compose.yml`
- Modify: `docker/delivery/docker/app.env`

**Interfaces:** none — config-only.

- [ ] **Step 1: Add `extra_hosts` to the `app` service**

In `docker/delivery/docker-compose.yml`, add to the `app` service (after `volumes:`, before `healthcheck:`):

```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

- [ ] **Step 2: Fix the PaddleX start command comment to include the page-limit override**

In `docker/delivery/docker/app.env`, replace the comment line:

```
# 部署前需要单独启动: paddlex --serve --pipeline PP-StructureV3 --device gpu:0 --port 8080
```

with:

```
# 部署前需要单独启动 PaddleX serving，并解除默认 10 页限制:
#   paddlex --get_pipeline_config PP-StructureV3 --save_path ./pp_structurev3.yaml
#   # 编辑 ./pp_structurev3.yaml 解除页数限制后再启动:
#   paddlex --serve --pipeline ./pp_structurev3.yaml --device gpu:0 --port 8080
```

- [ ] **Step 3: Document the wrapper's own HTTP timeout**

In `docker/delivery/docker/app.env`, add a commented-out line after `RETAIN_LOCAL_PADDLEX_URL`:

```
# 可选：PaddleX 请求超时（秒），默认 900。如果调大 RETAIN_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS
# 处理长论文，这个值也要一起调大，否则会先在这里超时。
# RETAIN_LOCAL_PADDLEX_TIMEOUT_SECONDS=900
```

- [ ] **Step 4: Verify the compose file is still valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('docker/delivery/docker-compose.yml'))" && echo "valid"`
Expected: `valid` (use whatever Python is on PATH — this doesn't need the project's pinned interpreter, it's just a YAML syntax check).

- [ ] **Step 5: Commit**

```bash
git add docker/delivery/docker-compose.yml docker/delivery/docker/app.env
git commit -m "fix(docker): resolve host.docker.internal on Linux, fix PaddleX page-limit trap in docs, document inner timeout"
```

---

### Task 11: Strengthen the Python integration test to cover the production args-construction path

**Why (added after final review round 2):** Every Critical bug found across both review rounds lived in a seam between layers that no single existing test covered: Task 3's integration test hand-builds a `SimpleNamespace` directly, bypassing `provider_pipeline.py`'s stage-spec-to-args translation — exactly the layer where the round-1 `RETAIN_OCR_RAW_PROVIDER` bug lived. Task 7 fixed that bug and added a narrow Rust test for the definition default, but nothing exercises the full Python-side spec-loading path for the `local`+`paddle` combination end-to-end. `test_provider_pipeline_entry.py::test_provider_pipeline_discovers_configured_local_provider` is the existing precedent for testing a `local`-kind provider through the real spec loader.

**Files:**
- Modify: `backend/scripts/devtools/tests/document_schema/test_provider_pipeline_entry.py`

**Interfaces:**
- Consumes: `services.ocr_provider.provider_pipeline` (existing, unchanged), `services.ocr_provider.local_paddlex_wrapper` (Tasks 1-2, unchanged)

- [ ] **Step 1: Read the existing local-provider test in this file for its exact spec-loading pattern**

Read `test_provider_pipeline_discovers_configured_local_provider` in this file fully (find it with `grep -n "def test_provider_pipeline_discovers_configured_local_provider" backend/scripts/devtools/tests/document_schema/test_provider_pipeline_entry.py`) to see exactly how it constructs a `provider.stage.v1` spec JSON and invokes the real `provider_pipeline` entry point — your new test should follow the same pattern, not invent a new one.

- [ ] **Step 2: Write a new test using that pattern, with `provider: "local"` and `raw_provider` left unset in the spec's `ocr.options`, relying on `RETAIN_OCR_RAW_PROVIDER=paddle` from the environment**

The test should:
1. Write a `provider.stage.v1` spec JSON with `ocr.provider = "local"` and `ocr.options = {"command": "<path to a Python one-liner that writes a minimal paddle-shaped raw payload, or reuses the local_paddlex_wrapper.py pattern from Task 3's integration test>"}` — critically, `ocr.options` must NOT include `"raw_provider"` at all (that's the point: proving the env var is what supplies it, matching production where the stage spec now carries an empty string default rather than a baked-in `"generic_flat_ocr"`).
2. `monkeypatch.setenv("RETAIN_OCR_RAW_PROVIDER", "paddle")`.
3. Invoke the real `provider_pipeline` entry point the same way `test_provider_pipeline_discovers_configured_local_provider` does.
4. Assert the resulting `document.v1.json`'s `source.provider == "paddle"` (not `"generic_flat_ocr"`) — this is the actual regression this test guards against.

- [ ] **Step 3: Run the test and the full document_schema suite**

Run: `PYTHONPATH=backend/scripts /home/thuandn/miniconda3/envs/retain-pdf-vi/bin/python -m pytest backend/scripts/devtools/tests/document_schema/test_provider_pipeline_entry.py -v`
Expected: new test PASSES.

Run: `PYTHONPATH=backend/scripts /home/thuandn/miniconda3/envs/retain-pdf-vi/bin/python -m pytest backend/scripts/devtools/tests/document_schema -q`
Expected: same pre-existing failure count as this plan's established baseline, no new failures.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/devtools/tests/document_schema/test_provider_pipeline_entry.py
git commit -m "test(ocr): cover local+paddle raw_provider resolution through the real spec-loading path"
```

---

## Self-Review Notes

- **Spec coverage:** OCR self-hosting via `local_command` + reused `paddle` adapter → Tasks 1-3. Page-limit trap → Tasks 4 (config comment, later corrected by Task 10) and 6 (manual verification). OpenRouter LLM switch → Task 5. Testing/verification plan from the spec → Tasks 1-3 (automated) and Task 6 (manual, since it requires real GPU hardware unavailable to an automated executor). Tasks 7-8 were added post-hoc after the first final-review round found the OCR path was unreachable end-to-end despite Tasks 1-5 being individually correct. Tasks 9-11 were added after a second final-review round found Task 8's frontend fix was itself incomplete (3 more stacked layers) and that 4 Important findings from round 1 were never addressed.
- **No new adapter code**: confirmed Tasks 1-3 only add the wrapper script and tests; `provider_adapters/paddle/` is untouched, matching the spec's Approach A.
- **Type/name consistency**: `local_paddlex_wrapper.PADDLEX_URL_ENV`, `.build_request_payload`, `.extract_layout_result`, `.run`, `.main` are used identically across Tasks 1, 2, and 3's integration test import.
- **Task 7/8 scope boundary**: both tasks are narrowly scoped to the exact two config/definition defaults the first final review identified as broken — no unrelated Rust or frontend refactoring.
- **Task 9 scope boundary**: touches only the credential-gate and payload-construction seam for provider-specific credential requirements; explicitly told not to do unrelated cleanup of the legacy/new credentials-system split.
- **Structural lesson applied**: Task 11 exists specifically because both review rounds found bugs in the seam between the stage-spec builder and the Python driver that no per-file unit test covered — it adds the missing layer-crossing test rather than more unit tests at either end.
