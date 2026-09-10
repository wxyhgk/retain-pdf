import json
from pathlib import Path
import sys

import pytest

from checkpoint_benchmark import main, measure


@pytest.mark.parametrize("dirty_pages", [0, 1, 2])
def test_small_checkpoint_benchmark_verifies_real_durable_output(dirty_pages):
    result = measure(2, dirty_pages, 2, items_per_page=2, text_bytes=32)
    assert result["verified"]
    assert result["model_requests"] == 0
    assert result["checkpoint_bytes"] > 0
    assert result["metrics"]["update_count"] == 2
    assert result["metrics"]["persist_count"] == 2
    assert result["metrics"]["save_failed_count"] == 0
    assert len(result["flush_wall_ms"]) == 2


def test_benchmark_cli_emits_only_json_and_accepts_small_offline_run(capsys):
    assert main(["--pages", "2", "--dirty-pages", "1", "--rounds", "1",
                 "--repeat", "1", "--warmup", "0", "--items-per-page", "1",
                 "--text-bytes", "16"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["inclusive_metrics"]
    assert report["groups"][0]["runs"][0]["verified"]
