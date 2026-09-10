import threading
from unittest.mock import Mock

from retainpdf_pipeline.translate.workflow import batch_runner as runner
from retainpdf_pipeline.translate.workflow.scheduling.page_order import page_ordered_batches, task_order


def test_page_order_splits_transport_batches_but_not_continuation_units():
    group = {"item_id": "group", "page_idx": 0, "translation_unit_members": [
        {"item_id": "a", "page_idx": 0}, {"item_id": "b", "page_idx": 1}]}
    early = {"item_id": "first", "page_idx": 0, "reading_order": 0}
    late = {"item_id": "last", "page_idx": 8}
    batches = page_ordered_batches([[late, early], [group]])
    assert batches == [[early], [group], [late]]
    assert batches[1][0] is group
    assert len(group["translation_unit_members"]) == 2


def test_mixed_routes_share_workers_and_take_earliest_page_first(monkeypatch):
    monkeypatch.setattr(runner, "execution_enabled", lambda: True)
    monkeypatch.setattr(runner, "raise_if_executor_failed", lambda: None)
    monkeypatch.setattr(runner, "flush_translation_memory", lambda _: None)
    monkeypatch.setattr(runner, "_should_drain_translation_tail_early", lambda *_: False)
    first_started = threading.Event()
    batch_started = threading.Event()
    seen = []
    lock = threading.Lock()
    pools = []
    start_workers = runner._start_translation_queue_workers

    def start_shared(**kwargs):
        pools.append((len(kwargs["tasks"]), kwargs["worker_count"]))
        assert kwargs["tasks"][0][3][0]["item_id"] == "first"
        return start_workers(**kwargs)

    monkeypatch.setattr(runner, "_start_translation_queue_workers", start_shared)

    def translate(batch, **kwargs):
        name = batch[0]["item_id"]
        with lock:
            seen.append(name)
        if name == "first":
            first_started.set()
            assert batch_started.wait(2), "shared worker did not pick up batched work"
        else:
            assert first_started.wait(2)
            batch_started.set()
        return {}

    monkeypatch.setattr(runner, "_translate_batch_or_keep_origin", translate)
    first = [{"item_id": "first", "page_idx": 0}]
    later = [{"item_id": "batch", "page_idx": 1}, {"item_id": "batch2", "page_idx": 1}]
    applier = Mock()
    applier.apply_batches.return_value = set()
    runner.run_translation_batches_parallel(
        batched_fast_batches=[later], single_fast_batches=[first], single_slow_batches=[],
        queue_workers={"batched_fast": 0, "single_fast": 2, "single_slow": 0},
        api_key="", model="", base_url="", domain_guidance="", mode="fast",
        translation_context=None, memory_store=None, result_applier=applier, flush_state=Mock())
    assert sorted(seen) == ["batch", "first"]
    assert batch_started.is_set()
    assert pools == [(2, 2)]


def test_fifo_tasks_are_sorted_across_routes_not_by_route_name():
    tasks = [("batched_fast", 1, 1, [{"item_id": "late", "page_idx": 5}]),
             ("single_fast", 1, 1, [{"item_id": "early", "page_idx": 0}])]
    assert sorted(tasks, key=task_order)[0][3][0]["item_id"] == "early"
