import pytest

from retainpdf_pipeline.translate.core.execution_policy import is_standalone_number, strategy
from retainpdf_pipeline.translate.workflow.scheduling.optimization import page_local_batches
from retainpdf_pipeline.translate.workflow.scheduling.metrics import SchedulerMetrics


@pytest.fixture(autouse=True)
def candidate(monkeypatch):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", "page_local_v1")


@pytest.mark.parametrize("text", ["1", "(1)", "[12]", "1.", " 23 "])
def test_only_explicit_number_forms_skip(text):
    assert is_standalone_number({"source_text": text})


@pytest.mark.parametrize("text", ["Introduction", "LiTMP", "12 mg", "1.2", "1+2", "(a)", "结论", "", "123abc", "−1", "¹", "1,000"])
def test_scientific_or_ambiguous_content_does_not_skip(text):
    assert not is_standalone_number({"source_text": text})


@pytest.mark.parametrize("extra", [{"continuation_group": "g"}, {"translation_unit_member_ids": ["a", "b"]},
                                   {"formula_map": {"x": "y"}}, {"translation_unit_id": "__cg__:g"},
                                   {"protected_map": {"x": "y"}}])
def test_protected_or_group_member_does_not_skip(extra):
    assert not is_standalone_number({"source_text": "(1)", **extra})


def test_strategy_is_opt_in_and_legacy_unchanged(monkeypatch):
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", "baseline")
    assert not is_standalone_number({"source_text": "1"})
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", "bad")
    with pytest.raises(ValueError):
        strategy()
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    assert strategy() == "baseline"


def test_repacking_fills_page_local_batches_and_preserves_coverage():
    items = [{"item_id": str(i), "page_idx": i // 10, "reading_order": i, "source_text": "x" * 300} for i in range(25)]
    batches = page_local_batches(list(reversed(items)), 8, lambda i: i["source_text"])
    assert [len(b) for b in batches] == [8, 2, 8, 2, 5]
    assert [i for b in batches for i in b] == items
    assert all(len({i["page_idx"] for i in b}) == 1 for b in batches)


def test_character_cap_and_math_mode_boundaries():
    items = [{"item_id": str(i), "page_idx": 0, "reading_order": i, "source_text": "x" * n, "math_mode": mode}
             for i, (n, mode) in enumerate([(1300, "a"), (1200, "a"), (1, "b"), (2500, "b"), (1, "b")])]
    batches = page_local_batches(items, 100, lambda i: i["source_text"])
    assert [len(b) for b in batches] == [1, 1, 1, 1, 1]
    assert len(batches[3][0]["source_text"]) == 2500
    assert page_local_batches([], 8, lambda i: "") == []


def test_metrics_distinguish_task_wait_and_applied_from_http_and_commit():
    m = SchedulerMetrics(2, 2)
    m.start(); m.start(); m.finish(); m.finish(); m.applied({0})
    d = m.snapshot()
    assert d["peak_active_tasks"] == 2 and d["finished_tasks"] == 2
    assert d["python_queue_wait_ms"]["max"] >= 0
    assert "1" in d["first_result_applied_ms_by_page"]
    assert "applied is not committed" in d["timing_scope"]


def test_committed_page_metric_uses_checkpoint_page_index_and_is_first_only():
    from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics
    d = TranslationRunDiagnostics("other", "test", "", 8, 8, 1)
    d.record_committed_pages([{"page_index": 0}, {"page_index": 2}])
    first = dict(d._first_page_commit_ms)
    d.record_committed_pages([{"page_index": 0}])
    assert d._first_page_commit_ms == first
    assert set(first) == {"1", "3"}


def test_large_page_plan_does_not_drop_or_duplicate_items():
    items = [{"item_id": str(i), "page_idx": i // 5, "reading_order": i} for i in range(2500)]
    batches = page_local_batches(list(reversed(items)), 8, lambda _: "text")
    assert len(batches) == 500
    assert [i["item_id"] for b in batches for i in b] == [i["item_id"] for i in items]


def test_builder_applies_filter_before_batching_and_returns_explicit_result(monkeypatch):
    from types import SimpleNamespace
    from retainpdf_pipeline.translate.workflow.batching import batching
    from retainpdf_pipeline.translate.services.fast_path.keep_origin import _is_fast_path_keep_origin_item, _fast_path_keep_origin_result
    monkeypatch.setattr(batching, "_is_low_risk_batchable_item", lambda *args, **kwargs: True)
    items = [{"item_id": "n", "page_idx": 0, "source_text": "(1)"},
             {"item_id": "body", "page_idx": 0, "source_text": "Introduction"}]
    batches, immediate = batching._build_translation_batches(items, effective_batch_size=8, translation_context=None,
        is_fast_path_keep_origin_item_fn=_is_fast_path_keep_origin_item,
        fast_path_keep_origin_result_fn=_fast_path_keep_origin_result,
        plan_item_view_fn=lambda item: SimpleNamespace(source=item["source_text"]))
    assert [i["item_id"] for b in batches for i in b] == ["body"]
    assert immediate[0]["n"]["decision"] == "keep_origin"
    assert immediate[0]["n"]["translation_diagnostics"]["degradation_reason"] == "skip_standalone_number"
