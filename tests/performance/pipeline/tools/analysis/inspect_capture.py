"""Verify private capture hashes and report counts, without API calls or prompt output."""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from support.paths import PIPELINE
sys.path.insert(0, str(PIPELINE))
from retainpdf_pipeline.translate.llm.shared.request_capture import digest, plan_input_digest


def load_capture(root):
    """Load and validate once; callers operate on the same verified payloads."""
    root = Path(root)
    if root.is_symlink():
        raise ValueError("capture directory symlinks are not allowed")
    plans = {}
    requests = []
    files = sorted(root.glob("plan-*.json")) + sorted(root.glob("request-*.json"))
    if not files:
        raise ValueError("capture is empty")
    for path in files:
        if path.is_symlink():
            raise ValueError("capture symlinks are not allowed")
        envelope = json.loads(path.read_text())
        payload = envelope["payload"]
        if digest(payload) != envelope["sha256"]:
            raise ValueError("capture integrity mismatch")
        if payload["schema"] == "translation_dispatch_plan_v1":
            if payload["input_sha256"] != plan_input_digest(payload):
                raise ValueError("plan input identity mismatch")
            if path.name != "plan-" + envelope["sha256"] + ".json":
                raise ValueError("plan filename mismatch")
            plans[envelope["sha256"]] = payload
        elif payload["schema"] == "translation_request_input_v1":
            if path.name != "request-" + digest(payload["operation_id"]) + ".json":
                raise ValueError("request filename mismatch")
            requests.append(payload)
        else:
            raise ValueError("unsupported capture schema")
    if any(r["plan_sha256"] is not None and r["plan_sha256"] not in plans for r in requests):
        raise ValueError("request refers to a missing plan")
    return plans, requests


def inspect(root):
    plans, requests = load_capture(root)
    return {"schema": "capture_inspection_v1", "plans": len(plans), "requests": len(requests),
            "plan_input_hashes": sorted(p["input_sha256"] for p in plans.values()),
            "requests_without_plan": sum(r["plan_sha256"] is None for r in requests),
            "purposes": dict(Counter(r["purpose"] for r in requests)),
            "planned_batches": sum(len(p["batches"]) for p in plans.values()),
            "message_chars": sum(len(m["content"]) for r in requests for m in r["messages"]),
            "note": "Integrity only. Captured inputs do not prove submission, completion or billing. "
                    "Requests without a plan may be pre-translation calls. No network replay is implemented."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--compare", type=Path, help="Compare dispatch input hashes only; not an acceptance gate")
    args = parser.parse_args()
    result = inspect(args.directory)
    if args.compare:
        other = inspect(args.compare)
        result["same_dispatch_inputs"] = bool(result["plan_input_hashes"]) and result["plan_input_hashes"] == other["plan_input_hashes"]
        result["comparison_scope"] = "Dispatch inputs only; runtime request guidance and provider outcomes require separate comparison."
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
