"""Compare saved reports offline; never submits jobs."""
import argparse
import json
from pathlib import Path


def compare(before: dict, after: dict) -> dict:
    differences = [key for key in ("pdf_sha256", "stage", "scope", "source_job", "model", "provider_host", "workers", "batch_size", "mode", "math_mode", "cache_policy") if before.get(key) != after.get(key)]
    metrics = {}
    for key in ("wall_seconds", "server_duration_seconds"):
        metrics[key] = {"before": before.get(key), "after": after.get(key)}
    for phase in sorted(set(before.get("phase_elapsed_ms", {}) or {}) | set(after.get("phase_elapsed_ms", {}) or {})):
        metrics[phase + "_ms"] = {"before": (before.get("phase_elapsed_ms") or {}).get(phase), "after": (after.get("phase_elapsed_ms") or {}).get(phase)}
    timing_scope_matches = before.get("server_duration_scope") == after.get("server_duration_scope")
    # These are nested inclusive observations, never additive stage durations.
    for group in ("result_flush", "checkpoint_timing", "garbled_reconstruction"):
        left, right = before.get(group) or {}, after.get(group) or {}
        for field in sorted(set(left) | set(right)):
            metrics[f"{group}.{field}"] = {"before": left.get(field), "after": right.get(field)}
    if not timing_scope_matches:
        differences.append("server_duration_scope")
    for name, pair in metrics.items():
        if name == "server_duration_seconds" and not timing_scope_matches:
            continue
        a, b = pair["before"], pair["after"]
        if isinstance(a, (int, float)) and a > 0 and isinstance(b, (int, float)):
            pair["change_percent"] = round((b - a) / a * 100, 2)
    return {"config_differences": differences, "successful_pair": before.get("status") == after.get("status") == "succeeded", "metrics": metrics, "note": "Negative change means faster; configuration/cache differences and failures prevent direct speedup claims."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    args = parser.parse_args()
    print(json.dumps(compare(json.loads(args.before.read_text()), json.loads(args.after.read_text())), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
