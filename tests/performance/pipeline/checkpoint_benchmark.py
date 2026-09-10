"""Zero-network checkpoint scaling benchmark; all writes use temporary directories.

Timings are inclusive and must not be added together. This measures persistence,
not model latency. Native filesystem caches are retained between repetitions.
"""
from __future__ import annotations

import argparse
from contextlib import redirect_stdout
import hashlib
import json
import os
from pathlib import Path
import statistics
import sys
import tempfile
import time
from unittest.mock import patch

from support.paths import PIPELINE

sys.path.insert(0, str(PIPELINE))
from retainpdf_pipeline.translate.core.payload import save_translations
from retainpdf_pipeline.translate.workflow.checkpoint.session import TranslationCheckpointSession


def measure(pages: int, dirty_pages: int, rounds: int, items_per_page: int = 10, text_bytes: int = 2048):
    with tempfile.TemporaryDirectory(prefix="retain-checkpoint-bench-") as directory:
        root = Path(directory)
        payloads = {
            page: [{"item_id": f"p{page}-i{item}", "source_text": "x" * text_bytes,
                    "protected_source_text": "x" * text_bytes, "translated_text": "translated",
                    "should_translate": True, "final_status": "translated", "decision": "translate",
                    "formula_map": [], "protected_map": []}
                   for item in range(items_per_page)]
            for page in range(pages)
        }
        paths = {page: root / f"page-{page + 1:04d}.json" for page in payloads}
        for page in paths:
            save_translations(paths[page], payloads[page])
        session = TranslationCheckpointSession(output_dir=root, identity={"fingerprint": "synthetic-benchmark"}, attempt_id="benchmark")
        session.store.acquire()
        try:
            session._initialize()
            session.update("translating", payloads, paths)
            before = session.metrics()
            latencies = []
            for iteration in range(rounds):
                changed = {}
                for offset in range(min(dirty_pages, pages)):
                    page = (iteration * max(1, dirty_pages) + offset) % pages
                    payloads[page][0]["translated_text"] = f"translated-{iteration}"
                    changed[page] = {payloads[page][0]["item_id"]}
                started = time.perf_counter_ns()
                for page in changed:
                    save_translations(paths[page], payloads[page])
                session.update("translating", payloads, paths, changed)
                latencies.append((time.perf_counter_ns() - started) / 1_000_000)
            after = session.metrics()
            session.update("validating", payloads, paths)
            session.complete(root / "manifest.json")
            persisted = session.store.load()
            assert persisted["progress"]["pending_item_count"] == 0
            for page in persisted["pages"]:
                assert hashlib.sha256((root / page["path"]).read_bytes()).hexdigest() == page["page_hash"]
                assert hashlib.sha256((root / page["snapshot_path"]).read_bytes()).hexdigest() == page["page_hash"]
            assert len(list((root / ".translation-checkpoints").iterdir())) == 1
            return {"pages": pages, "dirty_pages": min(dirty_pages, pages), "rounds": rounds,
                    "items_per_page": items_per_page, "source_text_bytes_per_item": text_bytes,
                    "flush_wall_ms": latencies,
                    "metrics": {key: after[key] - before[key] for key in before},
                    "checkpoint_bytes": session.store.path.stat().st_size,
                    "model_requests": 0, "verified": True}
        finally:
            session.close()


def nonnegative(value):
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be nonnegative")
    return number


def positive(value):
    number = nonnegative(value)
    if not number:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", nargs="+", type=positive, default=[17, 100, 500])
    parser.add_argument("--dirty-pages", nargs="+", type=nonnegative, default=[0, 1, 8])
    parser.add_argument("--rounds", type=positive, default=20)
    parser.add_argument("--repeat", type=positive, default=3)
    parser.add_argument("--warmup", type=nonnegative, default=1)
    parser.add_argument("--items-per-page", type=positive, default=10)
    parser.add_argument("--text-bytes", type=positive, default=2048)
    args = parser.parse_args(argv)
    groups = []
    with patch("socket.socket.connect", side_effect=AssertionError("network forbidden")), patch("socket.create_connection", side_effect=AssertionError("network forbidden")), open(os.devnull, "w") as sink:
        for pages in args.pages:
            for dirty in args.dirty_pages:
                with redirect_stdout(sink):
                    for _ in range(args.warmup):
                        measure(pages, dirty, args.rounds, args.items_per_page, args.text_bytes)
                    runs = [measure(pages, dirty, args.rounds, args.items_per_page, args.text_bytes) for _ in range(args.repeat)]
                durations = sorted(value for run in runs for value in run["flush_wall_ms"])
                groups.append({"pages": pages, "dirty_pages": dirty,
                               "median_flush_ms": statistics.median(durations),
                               "p95_flush_ms": durations[max(0, (95 * len(durations) + 99) // 100 - 1)], "runs": runs})
    print(json.dumps({"schema": "checkpoint_benchmark_v1", "inclusive_metrics": True,
                      "cache_policy": "native warm filesystem cache; no cache purge", "groups": groups}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
