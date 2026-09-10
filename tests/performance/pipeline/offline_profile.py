"""Profile the real translation IO fixture with fake transport; never calls a model."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import pstats
import statistics
import subprocess
import sys
import tempfile
import time

from support.paths import HERE, PIPELINE, ROOT

sys.path.insert(0, str(PIPELINE))
from support.translation_io_support import PROBE, SOURCES, document, environment, prepare, read_artifacts

# Inclusive main-thread durations: rows overlap and must never be summed.
TARGETS = {
    "pipeline": ("/translate/translation_stage.py", "translate_book_pipeline"),
    "preparation": ("/workflow/execution_plan.py", "build_translation_execution_plan"),
    "initial_continuation": ("/workflow/phases/continuation.py", "run_initial_continuation_pass"),
    "continuation_review": ("/workflow/phases/continuation.py", "run_continuation_review"),
    "page_policy": ("/workflow/phases/policy.py", "run_page_policy_stage"),
    "batch_stage": ("/workflow/phases/batch_translation.py", "run_translation_batch_stage"),
    "apply_results": ("/services/results/applier.py", "_apply_translated_results"),
    "page_write": ("/core/payload/translations.py", "_atomic_write_json"),
    "checkpoint_commit": ("/workflow/checkpoint/session.py", "_persist"),
    "garbled_repair": ("/workflow/phases/repair.py", "run_garbled_reconstruction_stage"),
    "agent_repair": ("/workflow/phases/repair.py", "run_agent_repair_stage"),
    "final_recovery": ("/workflow/phases/repair.py", "run_final_untranslated_recovery_stage"),
}


def extract_timings(stats):
    result = {}
    for label, (suffix, function) in TARGETS.items():
        values = [value for (filename, _, name), value in stats.items()
                  if filename.replace("\\", "/").endswith(suffix) and name == function]
        result[label] = ({"calls": sum(value[1] for value in values),
                          "inclusive_ms": round(sum(value[3] for value in values) * 1000, 3)}
                         if values else None)
    return result


def measure(root, workers):
    prepare(root, workers=workers, transport="rust", batch_size=1)
    started = time.perf_counter()
    process = subprocess.run(
        [sys.executable, "-m", "cProfile", "-o", str(root / "profile.pstats"),
         str(PROBE), str(root / "spec.json")],
        env=environment(root), capture_output=True, timeout=30,
    )
    wall_ms = (time.perf_counter() - started) * 1000
    if process.returncode != 0:
        raise RuntimeError("offline probe process failed; no provider retry was attempted")
    outcome = json.loads((root / "result.json").read_text())
    if not outcome["ok"] or outcome["violations"] or outcome["unknown_requests"]:
        raise RuntimeError("offline probe failed its zero-network/output contract")
    pages, manifest, checkpoint = read_artifacts(root)
    items = {item["item_id"]: item for page in pages.values() for item in page}
    if (set(items) != set(SOURCES) or manifest.get("status") != "complete"
            or checkpoint.get("progress", {}).get("pending_item_count") != 0):
        raise RuntimeError("offline probe did not publish the complete fixture")
    statuses = Counter(item.get("final_status") for item in items.values())
    if set(statuses) - {"translated", "kept_origin"}:
        raise RuntimeError("offline probe has unresolved items")
    return {"workers": workers, "process_wall_ms": round(wall_ms, 3),
            "fake_requests": len(outcome["calls"]), "status_counts": dict(statuses),
            "timings": extract_timings(pstats.Stats(str(root / "profile.pstats")).stats)}


def summarize(runs):
    groups = []
    for workers in sorted({run["workers"] for run in runs}):
        selected = [run for run in runs if run["workers"] == workers]
        medians = {}
        for label in TARGETS:
            values = [run["timings"][label]["inclusive_ms"] for run in selected
                      if run["timings"][label] is not None]
            medians[label] = round(statistics.median(values), 3) if len(values) == len(selected) else None
        groups.append({"workers": workers, "repeats": len(selected),
                       "median_process_wall_ms": round(statistics.median(run["process_wall_ms"] for run in selected), 3),
                       "median_inclusive_ms": medians})
    return groups


def bounded_positive(value):
    number = int(value)
    if not 1 <= number <= 32:
        raise argparse.ArgumentTypeError("must be between 1 and 32")
    return number


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=bounded_positive, nargs="+", default=[1, 8])
    parser.add_argument("--repeats", type=bounded_positive, default=5)
    args = parser.parse_args(argv)
    parent = ROOT / "tmp/pipeline-benchmarks"
    parent.mkdir(parents=True, exist_ok=True)
    output = Path(tempfile.mkdtemp(prefix="offline-profile-", dir=parent))
    report = {"schema": "translation_offline_profile_v1", "status": "running", "runs": [],
              "fixture_sha256": hashlib.sha256(json.dumps(document(), sort_keys=True).encode()).hexdigest(),
              "scope": "Synthetic 2-page/7-item fixture, fake Rust executor client, real Python stages and persistence. "
                       "No OCR, PDF render, Rust HTTP/DB execution or paid requests. Cold local cache per subprocess. "
                       "cProfile measures main-thread inclusive time only; worker CPU is not attributed. "
                       "Rows overlap; do not sum. Process wall includes startup/imports and profiler overhead. "
                       "Not a test1.pdf speed estimate or proof of parallel speedup."}
    report_path = output / "report.json"
    def save():
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    save()
    try:
        for repeat in range(args.repeats):
            # Interleave configurations to reduce systematic run-order bias.
            for workers in dict.fromkeys(args.workers):
                root = output / f"workers-{workers}-repeat-{repeat + 1}"
                report["runs"].append(measure(root, workers))
                save()
        report.update(status="succeeded", summary=summarize(report["runs"]))
    except Exception as error:
        report.update(status="failed", error_type=type(error).__name__)
        save()
        print(f"Offline profile failed; report: {report_path}")
        return 1
    save()
    print(json.dumps({"report": str(report_path), "summary": report["summary"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
