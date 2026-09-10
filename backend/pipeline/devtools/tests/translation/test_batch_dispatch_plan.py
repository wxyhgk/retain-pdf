"""Extraction equivalence plus independent, hand-reviewed dispatch contracts."""
from copy import deepcopy

import pytest

from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.workflow.batching import plan as planning
from retainpdf_pipeline.translate.workflow.scheduling.page_order import page_ordered_batches, task_order
from retainpdf_pipeline.translate.workflow.batch_runner import _translation_tasks


def _item(item_id, text, page=0, **extra):
    return dict(item_id=item_id, source_text=text, protected_source_text=text,
                page_idx=page, reading_order=0, block_type="text", should_translate=True, **extra)


def _sample(kind):
    if kind == "empty":
        return []
    if kind == "skip":
        return [_item("skip", "https://example.invalid", block_class="url")]
    text = "This sentence describes antibacterial activity and provides enough body text for translation."
    return [
        _item("late", text + " Late.", 2),
        _item("early", text + " Early.", 0),
        _item("early-two", text + " Second.", 0),
        _item("duplicate", text + " Early.", 3),
        _item("__cg__:group", text + " Continued.", 1, continuation_group="group",
              translation_unit_id="__cg__:group", translation_unit_member_ids=["member1", "member2"],
              translation_unit_members=[{"item_id": "member1", "page_idx": 1},
                                        {"item_id": "member2", "page_idx": 2}]),
        _item("slow", text + " Formula.", 0, _heavy_formula_split_applied=True,
              formula_map=[{"placeholder": "<f1-a7c/>"}]),
    ]


def _old_sequence(pending, workers, context):
    """Intentionally does not call the new plan builder or its stats methods."""
    unique, duplicates = planning._dedupe_pending_items(pending)
    size = planning._effective_translation_batch_size(
        batch_size=4, model="fixture", base_url="http://unused.invalid",
        translation_context=context)
    batches, immediate = planning._build_translation_batches(
        unique, effective_batch_size=size, translation_context=context)
    if planning.execution_enabled():
        batches = page_ordered_batches(batches)
    fast, single, slow = planning._classify_translation_batches(batches)
    flush = planning._save_flush_interval(workers=workers, total_batches=len(batches))
    cap = planning._slow_worker_cap(max(1, workers), len(slow))
    queues = planning._allocate_translation_queue_workers(
        workers, batched_fast_count=len(fast), single_fast_count=len(single),
        single_slow_count=len(slow), slow_worker_limit=cap)
    stats = planning.TranslationBatchRunStats(
        len(unique), len(batches), size, flush, max(1, workers), len(fast), len(single), len(slow),
        queues["batched_fast"], queues["single_fast"], queues["single_slow"], cap).as_dict()
    if planning.execution_enabled():
        stats["shared_workers"] = min(max(1, workers), len(batches))
    return unique, duplicates, batches, immediate, fast, single, slow, queues, stats


@pytest.mark.parametrize("transport,strategy", [("legacy", "baseline"), ("legacy", "page_local_v1"),
                                               ("rust", "baseline"), ("rust", "page_local_v1")])
@pytest.mark.parametrize("workers", [1, 8])
@pytest.mark.parametrize("kind", ["empty", "skip", "mixed"])
def test_dispatch_plan_matches_pre_extraction_sequence(monkeypatch, transport, strategy, workers, kind):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", transport)
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", strategy)
    context = build_translation_control_context()
    items = _sample(kind)
    before = deepcopy(items)
    expected = _old_sequence(deepcopy(items), workers, context)
    result = planning.build_batch_dispatch_plan(
        items, batch_size=4, workers=workers, model="fixture", base_url="http://unused.invalid",
        translation_context=context)
    assert (result.pending, result.duplicate_items_by_rep_id, result.batches, result.immediate_results,
            result.batched_fast_batches, result.single_fast_batches, result.single_slow_batches,
            result.queue_workers, result.stats_payload()) == expected
    assert items == before
    if kind == "skip":
        assert result.batches == []
        assert len(result.immediate_results) == 1
    if kind == "mixed":
        assert result.duplicate_items_by_rep_id["early"][0] is items[3]
        group = next(item for batch in result.batches for item in batch if item["item_id"] == "__cg__:group")
        assert group is items[4]
        candidate = next(item for batch in result.batches for item in batch if item["item_id"] == "early")
        assert candidate is not items[1]  # Existing candidate tagging uses a shallow copy.
    if transport == "rust":
        tasks = [task for route, batches in (
            ("batched_fast", result.batched_fast_batches), ("single_fast", result.single_fast_batches),
            ("single_slow", result.single_slow_batches)) for task in _translation_tasks(route, batches)]
        assert [task[3] for task in sorted(tasks, key=task_order)] == result.batches


# These are authored expectations, not snapshots generated by planning helpers.
# Legacy baseline preserves input order inside a cross-page transport batch.
# Legacy ignores page-local configuration; Rust orders singleton tasks by page.
_MIXED_BATCH_IDS = {
    ("legacy", "baseline"): (("late", "early", "early-two"), ("__cg__:group",), ("slow",)),
    ("legacy", "page_local_v1"): (("late", "early", "early-two"), ("__cg__:group",), ("slow",)),
    ("rust", "baseline"): (("early", "early-two"), ("slow",), ("__cg__:group",), ("late",)),
    ("rust", "page_local_v1"): (("early", "early-two"), ("slow",), ("__cg__:group",), ("late",)),
}
_MIXED_FAST_SINGLE_IDS = {
    ("legacy", "baseline"): (("__cg__:group",),),
    ("legacy", "page_local_v1"): (("__cg__:group",),),
    ("rust", "baseline"): (("__cg__:group",), ("late",)),
    ("rust", "page_local_v1"): (("__cg__:group",), ("late",)),
}


def _batch_ids(batches):
    """Project actual objects only; deliberately do not sort or regroup them."""
    return tuple(tuple(item["item_id"] for item in batch) for batch in batches)


@pytest.mark.parametrize("transport,strategy", list(_MIXED_BATCH_IDS))
@pytest.mark.parametrize("workers", [1, 8])
@pytest.mark.parametrize("kind", ["empty", "skip", "mixed"])
def test_dispatch_plan_has_independent_fixed_expectations(monkeypatch, transport, strategy, workers, kind):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", transport)
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", strategy)
    items = _sample(kind)
    result = planning.build_batch_dispatch_plan(
        items, batch_size=4, workers=workers, model="fixture", base_url="http://unused.invalid",
        translation_context=build_translation_control_context())

    assert result.run_stats.effective_batch_size == 4
    assert result.run_stats.effective_workers == workers
    if kind != "mixed":
        assert [item["item_id"] for item in result.pending] == ([] if kind == "empty" else ["skip"])
        assert result.duplicate_items_by_rep_id == {}
        assert result.batches == []
        assert _batch_ids(result.batches) == ()
        assert _batch_ids(result.batched_fast_batches) == ()
        assert _batch_ids(result.single_fast_batches) == ()
        assert _batch_ids(result.single_slow_batches) == ()
        assert result.total_batches == 0
        assert result.flush_interval == 1
        assert result.shared_workers == (0 if transport == "rust" else None)
        # Compatibility, not a proposed scheduling policy: the existing allocator
        # assigns all workers to the slow queue when there are no fast targets,
        # even when no task exists. No dispatch is scheduled by this empty plan.
        assert result.queue_workers == {
            "batched_fast": 0, "single_fast": 0, "single_slow": 0 if workers == 1 else 8,
        }
        if kind == "empty":
            assert result.immediate_results == []
        else:
            assert len(result.immediate_results) == 1
            assert list(result.immediate_results[0]) == ["skip"]
            kept = result.immediate_results[0]["skip"]
            assert kept["decision"] == "keep_origin"
            assert kept["translated_text"] == ""
            assert kept["final_status"] == "kept_origin"
        return

    assert [item["item_id"] for item in result.pending] == [
        "late", "early", "early-two", "__cg__:group", "slow",
    ]
    assert {rep: [item["item_id"] for item in duplicates]
            for rep, duplicates in result.duplicate_items_by_rep_id.items()} == {"early": ["duplicate"]}
    assert _batch_ids(result.batches) == _MIXED_BATCH_IDS[transport, strategy]
    legacy_baseline = transport == "legacy"
    assert _batch_ids(result.batched_fast_batches) == (
        (("late", "early", "early-two"),) if legacy_baseline else (("early", "early-two"),))
    assert _batch_ids(result.single_fast_batches) == _MIXED_FAST_SINGLE_IDS[transport, strategy]
    assert _batch_ids(result.single_slow_batches) == (("slow",),)
    assert result.immediate_results == []
    assert result.total_batches == (3 if legacy_baseline else 4)
    assert result.flush_interval == {1: 2, 8: 12}[workers]
    assert result.shared_workers == ({1: 1, 8: 4}[workers] if transport == "rust" else None)
    assert result.queue_workers == (
        {"batched_fast": 1, "single_fast": 0, "single_slow": 0} if workers == 1 else
        {"batched_fast": 3, "single_fast": 4, "single_slow": 1} if legacy_baseline else
        {"batched_fast": 2, "single_fast": 5, "single_slow": 1})
    assert result.run_stats.pending_items == 5
    assert result.run_stats.slow_worker_limit == 1

    groups = [item for batch in result.batches for item in batch if item["item_id"] == "__cg__:group"]
    assert len(groups) == 1  # Cross-page semantic groups must not become two requests.
    group = groups[0]
    assert group["translation_unit_id"] == "__cg__:group"
    assert group["continuation_group"] == "group"
    assert group["translation_unit_member_ids"] == ["member1", "member2"]
    assert group["translation_unit_members"] == [
        {"item_id": "member1", "page_idx": 1}, {"item_id": "member2", "page_idx": 2},
    ]


@pytest.mark.parametrize("workers", [1, 8])
@pytest.mark.parametrize("transport,strategy,expected,allocation", [
    ("legacy", "baseline", (("late", "early-a", "early-b", "early-c"), ("early-d",)), (4, 4, 0)),
    ("legacy", "page_local_v1", (("late", "early-a", "early-b", "early-c"), ("early-d",)), (4, 4, 0)),
    ("rust", "baseline", (("early-a", "early-b", "early-c"), ("early-d",), ("late",)), (3, 5, 0)),
    ("rust", "page_local_v1", (("early-a", "early-b", "early-c", "early-d"), ("late",)), (4, 4, 0)),
])
def test_fixed_page_local_plan_fills_page_before_batch_size_boundary(
    monkeypatch, workers, transport, strategy, expected, allocation,
):
    """A late item consumes a baseline slot, but not an early page-local slot.

    The smaller mixed fixture has identical Rust plans for both strategies.
    This five-item example independently distinguishes page-local grouping
    from merely sorting/splitting the baseline four-item chunks afterwards.
    """
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", transport)
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", strategy)
    text = "This sentence provides enough body text to qualify for translation batching. "
    items = [_item("late", text + "Late.", 2)] + [
        _item(f"early-{suffix}", text + suffix, 0) for suffix in "abcd"
    ]
    plan = planning.build_batch_dispatch_plan(
        items, batch_size=4, workers=workers, model="fixture", base_url="http://unused.invalid",
        translation_context=build_translation_control_context())
    assert _batch_ids(plan.batches) == expected
    assert plan.duplicate_items_by_rep_id == {}
    assert plan.immediate_results == []
    assert plan.single_slow_batches == []
    assert plan.queue_workers == dict(zip(
        ("batched_fast", "single_fast", "single_slow"), (1, 0, 0) if workers == 1 else allocation))


@pytest.mark.parametrize("workers", [1, 8])
def test_caller_prepares_once_and_shares_captured_plan_with_execution(monkeypatch, workers):
    from retainpdf_pipeline.translate.workflow.batching import pending_units
    from retainpdf_pipeline.translate.llm.shared import request_capture

    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", "baseline")
    items = _sample("mixed")
    observed = {}

    def prepare(flat):
        assert "prepared" not in observed
        observed["prepared"] = flat
        return flat

    def capture(batches, **kwargs):
        observed["captured"] = batches

    class Applier:
        def __init__(self, **kwargs):
            observed["applier"] = kwargs

        def apply_immediate(self, result):
            pass

    def sequential(batches, **kwargs):
        assert batches is observed["captured"]
        observed["executed"] = True

    def parallel(**kwargs):
        tasks = [task for route in ("batched_fast", "single_fast", "single_slow")
                 for task in _translation_tasks(route, kwargs[route + "_batches"])]
        executed = [task[3] for task in sorted(tasks, key=task_order)]
        assert executed == observed["captured"]
        assert all(actual is captured for actual, captured in zip(executed, observed["captured"]))
        observed["executed"] = True

    monkeypatch.setattr(pending_units, "pending_translation_items", prepare)
    monkeypatch.setattr(request_capture, "capture_plan", capture)
    monkeypatch.setattr(pending_units, "TranslationResultApplier", Applier)
    monkeypatch.setattr(pending_units, "run_translation_batches_sequential", sequential)
    monkeypatch.setattr(pending_units, "run_translation_batches_parallel", parallel)
    pending_units.translate_pending_units(
        page_payloads={0: items}, translation_paths={}, batch_size=4, workers=workers,
        api_key="unused", model="fixture", base_url="http://unused.invalid",
        translation_context=build_translation_control_context())
    assert observed["executed"]
    assert observed["applier"]["flat_payload"] is observed["prepared"]
    assert all(actual is original for actual, original in zip(observed["prepared"], items))
