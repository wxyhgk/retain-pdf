"""Four sequential, non-retried Qwen calls comparing default vs disabled thinking."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import uuid
from urllib.parse import urlparse

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from support.paths import ROOT, PIPELINE
sys.path.insert(0, str(PIPELINE))
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_single_item_fallback_messages
from run import load_config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    job_id = "bench-20260905-093636-7eb3ee1b"
    _, config = load_config(ROOT / "data/db/jobs.db", job_id)
    cfg = config["translation"]
    base = cfg["base_url"].rstrip("/")
    if urlparse(base).hostname != "dashscope.aliyuncs.com" or cfg["model"] != "qwen3.8-flash":
        raise ValueError("This bounded probe requires the saved DashScope qwen3.8-flash config")
    key = cfg.get("api_key") or os.environ.get("RETAIN_TRANSLATION_API_KEY", "")
    if not key and cfg.get("credential_ref"):
        vault = json.loads((ROOT / "data/secrets/credentials.json").read_text())
        key = vault.get("credentials", {}).get(cfg["credential_ref"], {}).get("secret", "")
    if not key:
        raise ValueError("No saved credential available")
    samples = []
    for page, item_id in [("009", "p009-b005"), ("001", "p001-b011")]:
        items = json.loads((ROOT / "data/jobs" / job_id / "translated" / f"page-{page}-deepseek.json").read_text())
        item = next(i for i in items if i["item_id"] == item_id)
        samples.append((item_id, build_single_item_fallback_messages(item, mode=cfg["mode"])))
    report = {"model": cfg["model"], "source_job": job_id, "concurrency": 1, "retry_count": 0,
              "read_timeout_seconds": 90, "max_tokens": 4096, "stream": False,
              "note": "Same reconstructed production prompt per pair; same 4096 output-token cap, not an exact uncapped production replay. Two samples, reversed order on second sample, no statistical speedup claim.", "results": []}
    print("Prepared 2 samples / at most 4 requests; 90s read timeout; shared max_tokens=4096.", flush=True)
    if not args.run:
        return 0
    out = ROOT / "tmp/pipeline-benchmarks" / ("thinking-probe-" + uuid.uuid4().hex[:10])
    out.mkdir(parents=True, mode=0o700)
    path = out / "report.json"
    def save():
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    save()
    session = requests.Session()
    session.trust_env = False
    print(f"Report: {path}", flush=True)
    try:
        for index, (item_id, messages) in enumerate(samples):
            modes = ["default", "disabled"] if index == 0 else ["disabled", "default"]
            for mode in modes:
                body = {"model": cfg["model"], "messages": messages, "temperature": 0.2, "stream": False, "max_tokens": 4096}
                if mode == "disabled":
                    body["enable_thinking"] = False
                result = {"item_id": item_id, "thinking": mode, "prompt_sha256": hashlib.sha256(json.dumps(messages, ensure_ascii=False).encode()).hexdigest()}
                print(f"Request {item_id} thinking={mode}", flush=True)
                started = time.monotonic()
                stop = False
                try:
                    with session.post(base + "/chat/completions", headers={"Authorization": "Bearer " + key}, json=body,
                                      timeout=(10, 90), allow_redirects=False) as response:
                        result["http_status"] = response.status_code
                        if response.status_code != 200:
                            result["error"] = "provider_rejected"
                            stop = True
                        else:
                            data = response.json()
                            choice = data["choices"][0]
                            msg = choice["message"]
                            result.update(finish_reason=choice.get("finish_reason"), content_chars=len(msg.get("content") or ""),
                                          reasoning_chars=len(msg.get("reasoning_content") or ""))
                            usage = data.get("usage") or {}
                            result["usage"] = {k: usage.get(k) for k in ("prompt_tokens", "completion_tokens", "total_tokens", "completion_tokens_details", "prompt_tokens_details")}
                except requests.exceptions.Timeout:
                    result["error"] = "timeout"
                except Exception as exc:
                    result["error"] = type(exc).__name__
                    stop = True
                result["elapsed_seconds"] = round(time.monotonic() - started, 3)
                report["results"].append(result)
                save()
                print(json.dumps(result, ensure_ascii=False), flush=True)
                if stop:
                    return 1
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
