"""Read-only evaluation of the two authorized runs; never dispatch requests."""
import argparse
import json
from pathlib import Path
import sys

# Keep the documented standalone CLI usable without a caller-provided PYTHONPATH.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from support.paths import PIPELINE
sys.path.insert(0, str(PIPELINE))
from retainpdf_pipeline.render.translation_loader import load_translated_pages
from support.optimization_evidence import compare_evidence


def metric(report, name):
    field = report["model_executor"]["metrics"][name]
    return field["sum"] if field["unknown_count"] == 0 else None


def results(report_path, report):
    job_id = report["job_id"]
    if Path(job_id).name != job_id:
        raise ValueError("invalid job ID")
    root = report_path.parent / "data/jobs" / job_id / "translated"
    items = {}
    manifest = json.loads((root / "translation-manifest.json").read_text())
    if not isinstance(manifest, dict) or manifest.get("status") != "complete":
        raise ValueError("translation manifest is not complete")
    pages = load_translated_pages(root)
    for page in pages.values():
        for item in page:
            if item["item_id"] in items:
                raise ValueError("duplicate item ID")
            items[item["item_id"]] = item
    return items, len(pages)


def evaluate(baseline_path, candidate_path):
    a, b = [json.loads(path.read_text()) for path in (baseline_path, candidate_path)]
    if any(a.get(k) != b.get(k) for k in ("pages", "workers", "model", "transport")):
        raise ValueError("incomparable run configuration")
    configuration = compare_evidence(baseline_path, a, candidate_path, b)
    errors = []
    artifacts = []
    for label, path, report in (("baseline", baseline_path, a), ("candidate", candidate_path, b)):
        try:
            artifacts.append(results(path, report))
        except (OSError, ValueError, RuntimeError, KeyError, TypeError, AttributeError):
            # Keep a machine-readable rejected comparison, without copying payload
            # contents or raw decoder errors into the shareable benchmark report.
            errors.append(f"invalid_translation_artifacts:{label}")
            artifacts.append(({}, 0))
    (old, old_pages), (new, new_pages) = artifacts
    if a["status"] != "succeeded" or b["status"] != "succeeded":
        errors.append("run_not_succeeded")
    if old_pages != new_pages or set(old) != set(new):
        errors.append("coverage_changed")
    for identity in sorted(set(old) & set(new)):
        before, after = old[identity], new[identity]
        for field in ("source_text", "formula_map", "translation_unit_member_ids"):
            if before.get(field) != after.get(field):
                errors.append(f"{field}_changed:{identity}")
                break
        if after.get("final_status") not in {"translated", "kept_origin"}:
            errors.append(f"unresolved_item:{identity}")
        if after.get("final_status") == "translated" and not str(after.get("translated_text") or "").strip():
            errors.append(f"empty_translation:{identity}")
        if before.get("final_status") != after.get("final_status"):
            reason = (after.get("translation_diagnostics") or {}).get("degradation_reason")
            if not (after.get("final_status") == "kept_origin" and reason == "skip_standalone_number"):
                errors.append(f"unexpected_status_change:{identity}")
    requests_a, requests_b = metric(a, "upstream_attempts"), metric(b, "upstream_attempts")
    tokens_a, tokens_b = metric(a, "input_tokens"), metric(b, "input_tokens")
    checks = {"integrity_checks_pass": not errors,
              "configuration_comparable": configuration["comparable"],
              "requests_reduced": requests_a is not None and requests_b is not None and requests_b < requests_a,
              "input_tokens_not_increased": tokens_a is not None and tokens_b is not None and tokens_b <= tokens_a,
              "wall_within_110_percent": b["wall_seconds"] <= a["wall_seconds"] * 1.10}
    return {"schema": "translation_optimization_comparison_v1", "accepted": all(checks.values()),
            "comparable": configuration["comparable"],
            "configuration": configuration,
            "checks": checks, "errors": errors, "baseline_report": str(baseline_path), "candidate_report": str(candidate_path),
            "wall_seconds": [a["wall_seconds"], b["wall_seconds"]], "upstream_attempts": [requests_a, requests_b],
            "input_tokens": [tokens_a, tokens_b], "output_tokens": [metric(a, "output_tokens"), metric(b, "output_tokens")],
            "cached_tokens": [metric(a, "cached_tokens"), metric(b, "cached_tokens")],
            "note": "One baseline then one candidate; cache and provider variability remain. Structural checks are not semantic quality evaluation. Cost unknown."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = evaluate(args.baseline, args.candidate)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(encoded)
    print(encoded)


if __name__ == "__main__":
    main()
