"""Pure pool layout construction; execution and result consumption stay in the runner."""
from __future__ import annotations

from typing import Callable

from retainpdf_translation.workflow.scheduling.page_order import task_order

TranslationTask = tuple[str, int, int, list[dict]]
PoolSpec = tuple[str, list[TranslationTask], int]


def translation_tasks(queue_name: str, batches: list[list[dict]]) -> list[TranslationTask]:
    total = len(batches)
    return [(queue_name, index, total, batch) for index, batch in enumerate(batches, start=1)]


def build_pool_specs(
    *,
    batched_fast_batches: list[list[dict]],
    single_fast_batches: list[list[dict]],
    single_slow_batches: list[list[dict]],
    queue_workers: dict[str, int],
    use_shared_queue: bool,
    batch_cost: Callable[[list[dict]], int] | None = None,
) -> list[PoolSpec]:
    specs = [
        ("batched_fast", translation_tasks("batched_fast", batched_fast_batches),
         int(queue_workers.get("batched_fast", 0) or 0)),
        ("single_fast", translation_tasks("single_fast", single_fast_batches),
         int(queue_workers.get("single_fast", 0) or 0)),
        ("slow", translation_tasks("single_slow", single_slow_batches),
         int(queue_workers.get("single_slow", 0) or 0)),
    ]
    if use_shared_queue:
        tasks = sorted([task for _, tasks, _ in specs for task in tasks], key=task_order)
        return [("shared_page_order", tasks, max(1, sum(queue_workers.values())))]
    # 两条快队列合成一个池、原文长的先发；慢队列照旧单独限路数。总并发由自适应限流统一管。
    # 以前按批数分线程：2026-10-31 Jensen 第 12 章批量队列 19 批（每批约 11 秒）只分到 8 个线程，要跑三轮；单块队列
    # 42 个线程 10 秒就把 98 个短请求跑完了、之后空着，翻译阶段 32 秒里后 20 秒只有 8 路在跑。
    # `batch_cost` 估计一批要跑多久（`workflow/batching/plan.batch_cost`：原文字数，接续组按整组），没给就保持原来的顺序。
    cost = batch_cost or (lambda _batch: 0)
    (_, batched, batched_workers), (_, single, single_workers), slow = specs
    fast = sorted([*batched, *single], key=lambda task: -cost(task[3]))
    return [("fast", fast, batched_workers + single_workers), (slow[0], sorted(slow[1], key=lambda task: -cost(task[3])), slow[2])]
