from concurrent.futures import Future
from unittest.mock import Mock

import pytest

from retainpdf_pipeline.translate.workflow import batch_runner as runner
from retainpdf_pipeline.translate.workflow.scheduling.pool_specs import build_pool_specs


def test_legacy_pool_labels_counts_and_batch_identity():
    first, second, slow = [{"item_id": "a"}], [{"item_id": "b"}], [{"item_id": "c"}]
    specs = build_pool_specs(
        batched_fast_batches=[first, second], single_fast_batches=[], single_slow_batches=[slow],
        queue_workers={"batched_fast": 2, "single_slow": 3}, use_shared_queue=False,
    )
    assert specs == [
        ("batched_fast", [("batched_fast", 1, 2, first), ("batched_fast", 2, 2, second)], 2),
        ("single_fast", [], 0), ("slow", [("single_slow", 1, 1, slow)], 3),
    ]
    assert specs[0][1][0][3] is first
    assert specs[2][1][0][3] is slow


def test_shared_pool_stable_ties_preserve_labels_and_group_references():
    tied_a = [{"item_id": "same", "page_idx": 1}]
    tied_b = [{"item_id": "same", "page_idx": 1}]
    group = [{"item_id": "group", "page_idx": 3,
              "translation_unit_members": [{"page_idx": 0}, {"page_idx": 3}]}]
    specs = build_pool_specs(
        batched_fast_batches=[tied_a], single_fast_batches=[tied_b], single_slow_batches=[group],
        queue_workers={"batched_fast": 2, "single_fast": 3, "single_slow": 1}, use_shared_queue=True,
    )
    name, tasks, workers = specs[0]
    assert (name, workers) == ("shared_page_order", 6)
    assert [task[0] for task in tasks] == ["single_slow", "batched_fast", "single_fast"]
    assert all(task[1:3] == (1, 1) for task in tasks)
    assert tasks[0][3] is group
    assert tasks[1][3] is tied_a
    assert tasks[2][3] is tied_b


def test_empty_shared_pool_keeps_minimum_worker_spec():
    assert build_pool_specs(
        batched_fast_batches=[], single_fast_batches=[], single_slow_batches=[],
        queue_workers={}, use_shared_queue=True,
    ) == [("shared_page_order", [], 1)]


@pytest.mark.parametrize("explicit,environment,expected", [(True, False, 1), (False, True, 2), (None, True, 1), (None, False, 2)])
def test_runner_uses_explicit_layout_or_compatibility_default(monkeypatch, explicit, environment, expected):
    monkeypatch.setattr(runner, "execution_enabled", lambda: environment)
    monkeypatch.setattr(runner, "raise_if_executor_failed", lambda: None)
    monkeypatch.setattr(runner, "flush_translation_memory", lambda _: None)
    monkeypatch.setattr(runner, "_should_drain_translation_tail_early", lambda *_: False)
    monkeypatch.setattr(runner, "_drain_translation_tail_queue", lambda **_: {})
    pools = []

    def start(**kwargs):
        pools.append(kwargs["tasks"])
        for queue, index, _, batch in kwargs["tasks"]:
            kwargs["result_queue"].put((queue, index, batch, {}, None))
        future = Future()
        future.set_result(None)
        return Mock(), [future]

    monkeypatch.setattr(runner, "_start_translation_queue_workers", start)
    applier = Mock()
    applier.apply_batches.return_value = set()
    runner.run_translation_batches_parallel(
        batched_fast_batches=[[{"item_id": "a", "page_idx": 1}]],
        single_fast_batches=[[{"item_id": "b", "page_idx": 0}]], single_slow_batches=[],
        queue_workers={"batched_fast": 1, "single_fast": 1, "single_slow": 0},
        api_key="", model="", base_url="", domain_guidance="", mode="fast",
        translation_context=None, memory_store=None, result_applier=applier,
        flush_state=Mock(), use_shared_queue=explicit,
    )
    assert len(pools) == expected
