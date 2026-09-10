from pathlib import Path
import sys

import pytest

from offline_profile import TARGETS, extract_timings, measure, summarize


def test_profile_extraction_is_inclusive_and_does_not_treat_missing_as_zero():
    timings = extract_timings({
        ("/repo/translate/translation_stage.py", 10, "translate_book_pipeline"): (1, 1, .01, .2, {}),
        ("/repo/services/results/applier.py", 99, "_apply_translated_results"): (2, 2, .001, .004, {}),
        ("/wrong/module.py", 10, "run_translation_batch_stage"): (1, 1, 5, 5, {}),
    })
    assert timings["pipeline"] == {"calls": 1, "inclusive_ms": 200}
    assert timings["apply_results"] == {"calls": 2, "inclusive_ms": 4}
    assert timings["batch_stage"] is None


def test_summary_keeps_unobserved_stages_unknown():
    rows = []
    for elapsed in (10, 20, 90):
        timings = dict.fromkeys(TARGETS)
        timings["pipeline"] = {"calls": 1, "inclusive_ms": elapsed}
        rows.append({"workers": 8, "process_wall_ms": elapsed + 5, "timings": timings})
    summary = summarize(rows)[0]
    assert summary["median_process_wall_ms"] == 25
    assert summary["median_inclusive_ms"]["pipeline"] == 20
    assert summary["median_inclusive_ms"]["page_write"] is None


@pytest.mark.parametrize("workers", [1, 8])
def test_profile_runs_real_io_contract_without_network(tmp_path, workers):
    result = measure(tmp_path / "run", workers)
    assert result["status_counts"] == {"translated": 6, "kept_origin": 1}
    assert result["fake_requests"] > 0
    for label in ("pipeline", "preparation", "batch_stage", "apply_results", "page_write", "checkpoint_commit"):
        assert result["timings"][label]["calls"] > 0
        assert result["timings"][label]["inclusive_ms"] >= 0
