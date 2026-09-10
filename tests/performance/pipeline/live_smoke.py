"""Isolated, opt-in Rust/Qwen translation test. No automatic resubmission."""
from __future__ import annotations

import argparse
import copy
from contextlib import ExitStack
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import sqlite3
import subprocess
import tempfile
import time
from urllib.parse import urlparse

import requests

from run import ROOT, api, load_config, positive
from support.reporting import collect_model_metrics, collect_metrics


def comparison_evidence(*, pdf_sha256, normalized_path, translation):
    """Fingerprint bounded test inputs; never serialize credentials into reports.

    The Rust child uses this run's fresh data/jobs as OUTPUT_ROOT. No translated
    results or local caches are copied from the source job. Provider-side cache
    warmth and scheduling remain uncontrolled, even when these hashes match.
    """
    def without_credentials(value):
        if isinstance(value, dict):
            return {key: without_credentials(item) for key, item in value.items()
                    if key not in {"api_key", "credential_ref"}}
        if isinstance(value, list):
            return [without_credentials(item) for item in value]
        return value

    def fingerprint(value):
        return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                        separators=(",", ":"), allow_nan=False).encode()).hexdigest()

    return {
        "schema": "translation_benchmark_evidence_v1",
        "pdf_sha256": pdf_sha256,
        "normalized_document_sha256": hashlib.sha256(normalized_path.read_bytes()).hexdigest(),
        "translation_config_sha256": fingerprint(without_credentials(translation)),
        "cache_policy_sha256": fingerprint({
            "version": 1, "local_output_root": "fresh_isolated_data_jobs",
            "copied_inputs": ["source", "ocr"], "restored_translation_cache": False,
            "provider_cache": "uncontrolled",
        }),
    }


def configure_translation(translation, *, workers, all_pages, fake_ip):
    translation = copy.deepcopy(translation)
    translation.update(api_key="", workers=workers, start_page=0, end_page=-1 if all_pages else 1,
                       page_ranges=[], accepted_ambiguous_request_risk=False)
    translation["execution_connection"] = {"id": "qwen-live-smoke", "revision": 1, "provider": "qwen",
        "model": translation["model"], "base_url": translation["base_url"],
        "credential_ref": translation["credential_ref"], "concurrency": workers,
        "thinking": "off", "allow_private_endpoint": fake_ip}
    return translation


def main():
    # Register private-resource cleanup before fallible initialization, not only
    # around the running process. ExitStack also runs it if process cleanup fails.
    with ExitStack() as resources:
        return _main(resources)


def _main(resources):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-job", required=True)
    parser.add_argument("--workers", type=positive, default=2)
    parser.add_argument("--strategy", choices=("baseline", "page_local_v1"), default="baseline")
    parser.add_argument("--all-pages", action="store_true", help="Translate the entire PDF instead of pages 1-2")
    parser.add_argument("--timeout", type=positive, default=1800)
    parser.add_argument("--run", action="store_true", help="Allow paid Qwen requests")
    parser.add_argument("--capture-inputs", action="store_true", help="Retain private plan and exact Python request inputs; contains document text")
    parser.add_argument("--allow-fake-ip", action="store_true", help="Explicitly allow local 198.18/15 proxy DNS for the fixed DashScope endpoint in this test")
    args = parser.parse_args()
    if Path(args.source_job).name != args.source_job or args.source_job in {".", ".."}:
        raise ValueError("Invalid source job")
    source = ROOT / "data/jobs" / args.source_job
    fixture = ROOT / "tmp/testPDF/test1.pdf"
    digest = hashlib.sha256(fixture.read_bytes()).digest()
    if not any(hashlib.sha256(p.read_bytes()).digest() == digest for p in (source / "source").glob("*.pdf")):
        raise ValueError("Source does not match test1.pdf")
    if not (source / "ocr/normalized/document.v1.json").is_file():
        raise ValueError("Normalized OCR is required; this test never submits OCR")
    _, config = load_config(ROOT / "data/db/jobs.db", args.source_job)
    translation = copy.deepcopy(config["translation"])
    if translation["model"] != "qwen3.8-flash":
        raise ValueError("Expected saved qwen3.8-flash model")
    endpoint = urlparse(translation["base_url"])
    if endpoint.scheme != "https" or endpoint.hostname != "dashscope.aliyuncs.com" or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise ValueError("This bounded test only allows the saved official DashScope HTTPS endpoint")
    addresses = {item[4][0] for item in socket.getaddrinfo(endpoint.hostname, 443)}
    fake_ip = any(ipaddress.ip_address(address) in ipaddress.ip_network("198.18.0.0/15") for address in addresses)
    if args.run and fake_ip and not args.allow_fake_ip:
        raise ValueError("Local proxy Fake-IP detected; review and explicitly pass --allow-fake-ip for this isolated test")
    if args.workers > 100:
        raise ValueError("workers must be at most 100")
    page_scope = "all" if args.all_pages else "1-2"
    print(f"Scope: test1.pdf pages {page_scope}, workers={args.workers}, Rust transport, saved Qwen model, reused OCR; no render.", flush=True)
    if not args.run:
        print("Preflight only; add --run to allow provider charges.")
        return 0
    output_parent = ROOT / "tmp/pipeline-benchmarks"
    output_parent.mkdir(parents=True, exist_ok=True)
    output = Path(tempfile.mkdtemp(prefix="rust-live-", dir=output_parent))
    data = output / "data"
    (data / "secrets").mkdir(parents=True, mode=0o700)
    vault_path = data / "secrets/credentials.json"
    resources.callback(vault_path.unlink, missing_ok=True)
    original_vault = json.loads((ROOT / "data/secrets/credentials.json").read_text())
    ref = translation["credential_ref"]
    vault_path.write_text(json.dumps({"schema": "retainpdf_credential_vault_v1", "credentials": {ref: original_vault["credentials"][ref]}}))
    vault_path.chmod(0o600)
    del original_vault
    for folder in ("source", "ocr"):
        shutil.copytree(source / folder, data / "jobs" / args.source_job / folder)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        simple_port = sock.getsockname()[1]
    key = secrets.token_hex(32)
    env = os.environ.copy()
    env.pop("RETAIN_TRANSLATION_CAPTURE_DIR", None)
    if args.capture_inputs:
        env["RETAIN_TRANSLATION_CAPTURE_DIR"] = str(output / "private-inputs")
    env.update(RUST_API_ROOT=str(output / "api-config"), RUST_API_PROJECT_ROOT=str(ROOT),
               RUST_API_DATA_ROOT=str(data), RUST_API_PORT=str(port), RUST_API_SIMPLE_PORT=str(simple_port), RUST_API_KEYS=key,
               RUST_API_JOBS_MODE="in_process", RUST_API_JOBS_SUPERVISE="false", RUST_API_AI_SUPERVISE="false",
               RETAIN_MODEL_EXECUTOR_ENABLED="1", RETAIN_MODEL_WORKER_ENABLED="1", RETAIN_MODEL_EXECUTOR_URL=base,
               RETAIN_TRANSLATION_OPTIMIZATION=args.strategy,
               PYTHON_BIN=str(ROOT / "backend/.venv/bin/python"),
               PYTHONPATH=str(ROOT / "backend/pipeline"), PATH=str(ROOT / "backend/.venv/bin") + os.pathsep + env.get("PATH", ""))
    job_id = "smoke-" + secrets.token_hex(8)
    report = {"job_id": job_id, "pages": "all" if args.all_pages else [1, 2], "workers": args.workers, "model": translation["model"], "transport": "rust", "status": "starting"}
    report["strategy"] = args.strategy
    report_path = output / "report.json"
    def save():
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    save()
    session = requests.Session()
    resources.callback(session.close)
    session.trust_env = False
    session.headers["X-API-Key"] = key
    def capture_local_error(response, *unused_args, **unused_kwargs):
        if response.status_code >= 400:
            message = response.text
            for sensitive in (key, json.loads(vault_path.read_text())["credentials"][ref]["secret"], translation.get("api_key", "")):
                if sensitive:
                    message = message.replace(sensitive, "[redacted]")
            report["local_http_error"] = {"status": response.status_code, "detail": message[:1000]}
    session.hooks["response"].append(capture_local_error)
    process = None
    submitted = False
    print(f"Report: {report_path}", flush=True)
    try:
        with (output / "api.log").open("w") as log:
            process = subprocess.Popen([str(ROOT / "target/debug/rust_api")], env=env, stdout=log, stderr=log, start_new_session=True)
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("Isolated API exited")
            try:
                response = session.get(base + "/api/v1/jobs", timeout=1)
                if response.status_code == 200:
                    break
            except requests.RequestException:
                pass
            time.sleep(0.2)
        else:
            raise RuntimeError("Isolated API did not become ready")
        # Import only this terminal source row and its artifact registry into
        # the newly initialized test DB, never the live database or checkpoints.
        with sqlite3.connect((ROOT / "data/db/jobs.db").as_uri() + "?mode=ro", uri=True) as origin, sqlite3.connect(data / "db/jobs.db") as target:
            for table in ("jobs", "artifacts", "job_artifact_entries"):
                cursor = origin.execute(f"SELECT * FROM {table} WHERE job_id=?", (args.source_job,))
                names = [column[0] for column in cursor.description]
                rows = cursor.fetchall()
                target.executemany(f"INSERT INTO {table} ({','.join(names)}) VALUES ({','.join('?' for _ in names)})", rows)
        translation = configure_translation(translation, workers=args.workers, all_pages=args.all_pages, fake_ip=fake_ip)
        report["comparison_evidence"] = comparison_evidence(
            pdf_sha256=digest.hex(),
            normalized_path=data / "jobs" / args.source_job / "ocr/normalized/document.v1.json",
            translation=translation,
        )
        save()
        payload = {"workflow": "translate", "source": {"artifact_job_id": args.source_job}, "translation": translation,
                   "runtime": {"job_id": job_id, "timeout_seconds": args.timeout, "render_after_translation": False}}
        started = time.monotonic()
        submitted = True
        api(session, base, "POST", "/api/v1/jobs", json=payload)
        last = None
        while time.monotonic() - started < args.timeout + 20:
            state = api(session, base, "GET", f"/api/v1/jobs/{job_id}")
            report.update(status=state["status"], wall_seconds=round(time.monotonic() - started, 3))
            report["model_executor"] = collect_model_metrics(data / "db/jobs.db", job_id)
            save()
            if report["status"] != last:
                print(f"status={report['status']} elapsed={report['wall_seconds']}s", flush=True)
                last = report["status"]
            if last in {"succeeded", "failed", "canceled", "cancelled"}:
                report["pipeline"] = collect_metrics(data / "jobs" / job_id)
                save()
                return 0 if last == "succeeded" else 1
            time.sleep(2)
        raise TimeoutError("Smoke deadline reached; no automatic retry")
    except Exception as error:
        report.update(status="error", error_type=type(error).__name__)
        save()
        print(f"Stopped: {type(error).__name__}; inspect local private logs, do not resubmit blindly.", flush=True)
        return 1
    finally:
        if submitted:
            try:
                api(session, base, "POST", f"/api/v1/jobs/{job_id}/cancel")
            except Exception:
                pass
        if process is not None and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
