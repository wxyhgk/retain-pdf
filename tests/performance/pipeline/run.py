"""Benchmark OCR, translation, rendering, or the full local pipeline.

Preview: .venv/bin/python tests/performance/pipeline/run.py --stage translate
Execute: add --run (provider charges may apply).
No keys are accepted on the command line or written to the benchmark report.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time
import uuid
from urllib.parse import urlparse

import requests

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from support.reporting import collect_metrics, collect_model_metrics, server_timing
from support.paths import ROOT


def load_config(db: Path, job_id: str | None) -> tuple[str, dict]:
    with sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True) as conn:
        query = "SELECT job_id, request_json FROM jobs"
        rows = conn.execute(
            query + (" WHERE job_id = ?" if job_id else " ORDER BY updated_at DESC"),
            (job_id,) if job_id else (),
        )
        for source_id, raw in rows:
            config = json.loads(raw)
            if "qwen" in str(config.get("translation", {}).get("model", "")).lower():
                return source_id, config
    raise ValueError("No saved Qwen job config found; specify --config-job with a Qwen job ID.")


def build_payload(config: dict, upload_id: str, job_id: str, args) -> dict:
    translation = copy.deepcopy(config["translation"])
    # Test the whole fixture, not an old task's page selection or resume policy.
    translation.update(start_page=0, end_page=-1, page_ranges=[], accepted_ambiguous_request_risk=False)
    if args.workers is not None:
        translation["workers"] = args.workers
        if translation.get("execution_connection"):
            translation["execution_connection"]["concurrency"] = args.workers
    if args.batch_size is not None:
        translation["batch_size"] = args.batch_size
    ocr = copy.deepcopy(config.get("ocr", {}))
    ocr.update(page_ranges="", data_id="")
    stage = getattr(args, "stage", "translate")
    source_job = getattr(args, "source_job", None)
    return {
        "workflow": "book" if stage == "full" else stage,
        "source": {"artifact_job_id": source_job} if source_job else {"upload_id": upload_id},
        "ocr": ocr, "translation": translation,
        "render": copy.deepcopy(config.get("render", {})),
        "runtime": {"job_id": job_id, "timeout_seconds": args.timeout, "render_after_translation": False},
    }


def api(session, base: str, method: str, path: str, **kwargs) -> dict:
    # Never echo error bodies: an upstream error may include request credentials.
    response = session.request(method, base + path, timeout=60, allow_redirects=False, **kwargs)
    if not 200 <= response.status_code < 300:
        raise RuntimeError(f"Local API returned HTTP {response.status_code} for {method} {path}")
    body = response.json()
    data = body.get("data", body)
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected local API response shape")
    return data


def positive(value: str) -> int:
    result = int(value)
    if result < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=ROOT / "tmp/testPDF/test1.pdf")
    parser.add_argument("--config-job", help="Existing Qwen job; defaults to latest saved Qwen config")
    parser.add_argument("--api", default="http://127.0.0.1:41000")
    parser.add_argument("--stage", choices=("ocr", "translate", "render", "full"), default="translate")
    parser.add_argument("--source-job", help="Reuse matching PDF artifacts: OCR for translate, translations for render")
    parser.add_argument("--workers", type=positive)
    parser.add_argument("--batch-size", type=positive)
    parser.add_argument("--timeout", type=positive, default=1800)
    parser.add_argument("--run", action="store_true", help="Submit a real OCR/translation job (provider charges may apply)")
    args = parser.parse_args()
    endpoint = urlparse(args.api)
    if endpoint.scheme != "http" or endpoint.hostname not in {"localhost", "127.0.0.1", "::1"} or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise ValueError("Only a local HTTP API is allowed; credentials must not be sent to a remote host")
    args.api = args.api.rstrip("/")
    pdf = args.pdf.resolve()
    if not pdf.is_file() or not pdf.read_bytes().startswith(b"%PDF-"):
        raise ValueError("PDF file missing or invalid")
    source_id, config = load_config(ROOT / "data/db/jobs.db", args.config_job)
    if args.stage == "render" and not args.source_job:
        raise ValueError("Render requires --source-job from a translated job")
    if args.source_job and args.stage not in {"translate", "render"}:
        raise ValueError("--source-job is only supported for translate/render")
    if args.source_job:
        if Path(args.source_job).name != args.source_job or args.source_job in {".", ".."}:
            raise ValueError("Invalid source job ID")
        source_root = ROOT / "data/jobs" / args.source_job
        fixture_hash = hashlib.sha256(pdf.read_bytes()).digest()
        if not any(hashlib.sha256(p.read_bytes()).digest() == fixture_hash for p in (source_root / "source").glob("*.pdf")):
            raise ValueError("Source job PDF does not match --pdf")
        artifact = source_root / ("translated/translation-manifest.json" if args.stage == "render" else "ocr/normalized/document.v1.json")
        if not artifact.is_file():
            raise ValueError("Source job lacks required normalized OCR or translation manifest")
    payload = build_payload(config, "", "", args)
    translation = payload["translation"]
    if not (translation.get("api_key") or translation.get("credential_ref")):
        raise ValueError("Saved Qwen config has no credential; submit a configured translation in the app first")
    provider = urlparse(translation.get("base_url", ""))
    if provider.scheme not in {"http", "https"} or not provider.hostname or provider.username or provider.password or provider.query:
        raise ValueError("Invalid saved translation endpoint")
    report = {
        "schema": "pipeline_benchmark_v2", "config_job": source_id,
        "stage": args.stage, "source_job": args.source_job,
        "pdf": str(pdf), "pdf_sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "model": translation["model"], "provider_host": provider.hostname,
        "workers": translation.get("workers"), "batch_size": translation.get("batch_size"),
        "mode": translation.get("mode"), "math_mode": translation.get("math_mode"),
        "scope": {"ocr": "OCR + normalization", "translate": "translation only" if args.source_job else "OCR + normalization + translation", "render": "render only", "full": "OCR + normalization + translation + render"}[args.stage],
        "cache_policy": "existing pipeline caches enabled; not a cold-cache benchmark",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    if not args.run:
        print("Preflight only; no upload or paid request. Add --run to execute.")
        return 0
    job_id = "bench-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
    output = ROOT / "tmp/pipeline-benchmarks" / job_id
    output.mkdir(parents=True, mode=0o700)
    report_path = output / "report.json"

    def save():
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    session = requests.Session()
    session.trust_env = False
    session.headers["X-API-Key"] = os.environ.get("RETAIN_BENCH_API_KEY", "dev-local-key")
    started = time.monotonic()
    report.update(job_id=job_id, status="preparing")
    save()
    submitted = False
    try:
        upload = {"upload_id": ""}
        if not args.source_job:
            with pdf.open("rb") as handle:
                upload = api(session, args.api, "POST", "/api/v1/uploads", files={"file": (pdf.name, handle, "application/pdf")})
        payload = build_payload(config, upload["upload_id"], job_id, args)
        # No automatic retry of POST: an ambiguous response must not create duplicate paid work.
        report["status"] = "submitting"
        save()
        submitted = True
        api(session, args.api, "POST", "/api/v1/jobs", json=payload)
        last = None
        while True:
            state = api(session, args.api, "GET", f"/api/v1/jobs/{job_id}")
            current = (state.get("status"), (state.get("stage_snapshot") or {}).get("stage", state.get("stage")))
            if current != last:
                print(f"{job_id}: status={current[0]} stage={current[1]} elapsed={time.monotonic()-started:.1f}s", flush=True)
                last = current
            report.update(status=current[0], wall_seconds=round(time.monotonic()-started, 3))
            save()
            if current[0] in {"succeeded", "failed", "cancelled", "canceled"}:
                break
            if time.monotonic() - started > args.timeout:
                raise TimeoutError("Benchmark deadline reached")
            time.sleep(3)
        artifacts = ROOT / "data/jobs" / job_id / "artifacts"
        report["artifacts_dir"] = str(artifacts)
        report.update(collect_metrics(artifacts.parent))
        child_id = (state.get("ocr_job") or {}).get("job_id")
        if child_id and Path(child_id).name == child_id and child_id not in {".", ".."}:
            report["ocr_child_metrics"] = collect_metrics(ROOT / "data/jobs" / child_id)
        report.update(server_timing(state))
        report["model_executor"] = collect_model_metrics(ROOT / "data/db/jobs.db", job_id)
        report["ocr_reused"] = state.get("ocr_reused")
        save()
        print(f"Report: {report_path}")
        return 0 if report["status"] == "succeeded" else 1
    except (Exception, KeyboardInterrupt) as exc:
        report.update(status="interrupted" if isinstance(exc, KeyboardInterrupt) else "error", error_type=type(exc).__name__)
        if submitted:
            try:
                api(session, args.api, "POST", f"/api/v1/jobs/{job_id}/cancel")
                report["cancel_requested"] = True
            except Exception:
                report["cancel_requested"] = False
        save()
        print(f"Benchmark stopped ({type(exc).__name__}); inspect {report_path}. No request body or key was logged.")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Preflight failed ({type(exc).__name__}). Check PDF, saved Qwen job config, and local database.")
        raise SystemExit(1)
