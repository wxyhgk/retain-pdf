"""Pure pool layout construction; execution and result consumption stay in the runner."""
from __future__ import annotations

from retainpdf_pipeline.translate.workflow.scheduling.page_order import task_order

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
    return specs
