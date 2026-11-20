from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TranslationBatchRunStats:
    pending_items: int
    total_batches: int
    effective_batch_size: int
    flush_interval: int
    effective_workers: int
    batched_fast_batches: int
    single_fast_batches: int
    single_slow_batches: int
    batched_fast_workers: int = 0
    single_fast_workers: int = 0
    single_slow_workers: int = 0
    slow_worker_limit: int = 0

    def as_dict(self) -> dict[str, int]:
        fast_queue_workers = self.batched_fast_workers + self.single_fast_workers
        return {
            "pending_items": self.pending_items,
            "total_batches": self.total_batches,
            "effective_batch_size": self.effective_batch_size,
            "flush_interval": self.flush_interval,
            "effective_workers": self.effective_workers,
            "fast_queue_batches": self.batched_fast_batches + self.single_fast_batches,
            "slow_queue_batches": self.single_slow_batches,
            "fast_queue_workers": fast_queue_workers,
            "batched_fast_batches": self.batched_fast_batches,
            "single_fast_batches": self.single_fast_batches,
            "single_slow_batches": self.single_slow_batches,
            "batched_fast_workers": self.batched_fast_workers,
            "single_fast_workers": self.single_fast_workers,
            "single_slow_workers": self.single_slow_workers,
            "slow_worker_limit": self.slow_worker_limit,
        }


__all__ = ["TranslationBatchRunStats"]
