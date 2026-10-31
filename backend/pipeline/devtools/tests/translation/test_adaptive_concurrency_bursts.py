"""自适应并发：同一次撞上限只降一次、降到撞上限时在跑的路数附近、很快升回去；长的单元先发。

2026-10-30 四个 legacy 任务（claude-haiku-5-5，workers=50）开局 32 路正好顶到 Anthropic 的组织并发上限，同一刻 3—5 个
请求一起挨 429，以前每个都砍一半（32 → 16 → 8），每连续成功 12 次才加 1，最后都停在 9—16 路：Jensen 第 12 章 117 个请求
共 525 秒，32 路本该 17 秒跑完，实际 48 秒。
"""

from __future__ import annotations

from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.workflow.batching.plan import batch_cost
from retainpdf_translation.workflow.scheduling.pool_specs import build_pool_specs


def _run(limit: int = 32) -> TranslationRunDiagnostics:
    run = TranslationRunDiagnostics(
        provider_family="other",
        model="claude-haiku-5-5",
        base_url="https://api.anthropic.com/v1",
        configured_workers=50,
        configured_batch_size=8,
        configured_classify_batch_size=12,
    )
    run.configure_adaptive_concurrency(initial_limit=limit, floor_limit=8)
    return run


def _limit(run: TranslationRunDiagnostics) -> int:
    return run.build_summary()["adaptive_concurrency"]["current_limit"]


def test_a_burst_of_429s_from_one_collision_cuts_once_to_just_below_the_inflight_count() -> None:
    run = _run()
    epochs = [run.acquire_request_slot() for _ in range(32)]
    for epoch in epochs[:4]:
        run.release_request_slot(success=False, elapsed_ms=2300, status_code=429, error_class="HTTPError", slot_epoch=epoch)
    summary = run.build_summary()["adaptive_concurrency"]
    assert summary["cut_count"] == 1
    assert summary["ceiling_limit"] == 30, "32 in flight when the limit was hit"
    assert summary["current_limit"] == 24, "min(32 * 0.75, 30)"


def test_after_the_cut_the_limit_climbs_back_to_the_ceiling_quickly() -> None:
    run = _run()
    epochs = [run.acquire_request_slot() for _ in range(32)]
    run.release_request_slot(success=False, elapsed_ms=2300, status_code=429, error_class="HTTPError", slot_epoch=epochs[0])
    assert _limit(run) == 24
    ok = lambda epoch: run.release_request_slot(success=True, elapsed_ms=3000, status_code=200, slot_epoch=epoch)  # noqa: E731
    for epoch in epochs[1:13]:
        ok(epoch)
    assert _limit(run) == 30, "below the ceiling: one step per two successes (24 -> 30 in 12)"
    for epoch in epochs[13:24]:
        ok(epoch)
    assert _limit(run) == 30, "at the ceiling: back to the old slow probing (12 successes per step)"
    ok(epochs[24])
    assert _limit(run) == 31


def test_a_later_collision_cuts_again() -> None:
    run = _run()
    first = [run.acquire_request_slot() for _ in range(32)]
    run.release_request_slot(success=False, elapsed_ms=2000, status_code=429, error_class="HTTPError", slot_epoch=first[0])
    for epoch in first[1:]:
        run.release_request_slot(success=True, elapsed_ms=3000, status_code=200, slot_epoch=epoch)
    later = [run.acquire_request_slot() for _ in range(20)]
    run.release_request_slot(success=False, elapsed_ms=2000, status_code=429, error_class="HTTPError", slot_epoch=later[0])
    summary = run.build_summary()["adaptive_concurrency"]
    assert summary["cut_count"] == 2 and summary["ceiling_limit"] == 18


def test_server_errors_still_halve_but_once_per_collision() -> None:
    run = _run()
    epochs = [run.acquire_request_slot() for _ in range(32)]
    for epoch in epochs[:3]:
        run.release_request_slot(success=False, elapsed_ms=2000, status_code=503, error_class="HTTPError", slot_epoch=epoch)
    assert _limit(run) == 16


def test_callers_that_do_not_pass_the_epoch_keep_the_old_behaviour() -> None:
    run = _run()
    for _ in range(3):
        run.acquire_request_slot()
    run.release_request_slot(success=False, elapsed_ms=2000, status_code=503, error_class="HTTPError")
    run.release_request_slot(success=False, elapsed_ms=2000, status_code=503, error_class="HTTPError")
    assert _limit(run) == 8


def test_fast_queues_share_one_pool_and_long_units_go_first() -> None:
    def unit(item_id: str, chars: int) -> list[dict]:
        return [{"item_id": item_id, "protected_source_text": "x" * chars}]

    batched = [unit("p001-b001", 100) + unit("p001-b002", 900)[:1], unit("p003-b001", 300)]
    single = [unit("p002-b001", 1500), unit("p004-b001", 100), unit("p005-b001", 100)]
    group = [{"item_id": "__cg__:g", "protected_source_text": "y" * 50, "translation_unit_protected_source_text": "y" * 2000}]
    specs = build_pool_specs(
        batched_fast_batches=batched,
        single_fast_batches=[*single, group],
        single_slow_batches=[unit("p009-b001", 50), unit("p009-b002", 5000)],
        queue_workers={"batched_fast": 8, "single_fast": 42, "single_slow": 2},
        use_shared_queue=False,
        batch_cost=batch_cost,
    )
    (fast_name, fast, fast_workers), (slow_name, slow, slow_workers) = specs
    assert fast_workers == 50 and slow_workers == 2
    assert [t[3][0]["item_id"] for t in fast] == ["__cg__:g", "p002-b001", "p001-b001", "p003-b001", "p004-b001", "p005-b001"]
    assert [t[0] for t in fast][:4] == ["single_fast", "single_fast", "batched_fast", "batched_fast"], "tasks keep their queue name"
    assert [t[3][0]["item_id"] for t in slow] == ["p009-b002", "p009-b001"]

