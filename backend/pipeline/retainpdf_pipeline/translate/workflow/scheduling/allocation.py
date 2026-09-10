from __future__ import annotations

import os


DEEPSEEK_ADAPTIVE_INITIAL_LIMIT_ENV = "RETAIN_TRANSLATION_DEEPSEEK_INITIAL_CONCURRENCY_LIMIT"
PREFIX_CACHE_WARMUP_ENV = "RETAIN_TRANSLATION_PREFIX_CACHE_WARMUP"


def prefix_cache_warmup_enabled(provider_family: str) -> bool:
    # 首条请求单独放行,写入 provider 的前缀缓存后再放开全并发。
    # 仅对支持前缀缓存计价的 deepseek 官方 API 默认开启。
    if provider_family != "deepseek_official":
        return False
    value = str(os.environ.get(PREFIX_CACHE_WARMUP_ENV, "") or "").strip().lower()
    return value not in {"0", "false", "off", "no"}


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    value = str(os.environ.get(name, "") or "").strip()
    if not value:
        return max(minimum, int(default))
    try:
        return max(minimum, int(value))
    except ValueError:
        return max(minimum, int(default))


def _empty_worker_allocation() -> dict[str, int]:
    return {
        "batched_fast": 0,
        "single_fast": 0,
        "single_slow": 0,
    }


def _single_worker_allocation(*, batched_fast_count: int, single_fast_count: int, single_slow_count: int) -> dict[str, int]:
    allocation = _empty_worker_allocation()
    first_queue = next(
        (
            name
            for name, count in (
                ("batched_fast", batched_fast_count),
                ("single_fast", single_fast_count),
                ("single_slow", single_slow_count),
            )
            if count > 0
        ),
        "",
    )
    if first_queue:
        allocation[first_queue] = 1
    return allocation


def _slow_worker_cap(workers: int, single_slow_count: int = 0) -> int:
    if single_slow_count <= 0:
        return 0
    if workers <= 8:
        base = 1
    elif workers <= 24:
        base = 2
    else:
        base = min(4, max(2, workers // 8))
    backlog_scaled = max(base, max(1, workers // 4))
    return min(single_slow_count, backlog_scaled)


def adaptive_floor_limit(workers: int) -> int:
    return max(1, min(8, max(1, workers)))


def adaptive_initial_limit(workers: int) -> int:
    worker_count = max(1, int(workers))
    if worker_count <= 32:
        return worker_count
    return min(worker_count, 32)


def provider_adaptive_initial_limit(*, workers: int, provider_family: str = "") -> int:
    worker_count = max(1, int(workers))
    if provider_family == "deepseek_official":
        return min(worker_count, _env_int(DEEPSEEK_ADAPTIVE_INITIAL_LIMIT_ENV, worker_count))
    return adaptive_initial_limit(worker_count)


def _adaptive_floor_limit(workers: int) -> int:
    return adaptive_floor_limit(workers)


def _adaptive_initial_limit(workers: int) -> int:
    return adaptive_initial_limit(workers)


def _provider_adaptive_initial_limit(*, workers: int, provider_family: str = "") -> int:
    return provider_adaptive_initial_limit(workers=workers, provider_family=provider_family)


def _fast_queue_targets(*, batched_fast_count: int, single_fast_count: int) -> list[tuple[str, int]]:
    return [
        (name, count)
        for name, count in (
            ("batched_fast", batched_fast_count),
            ("single_fast", single_fast_count),
        )
        if count > 0
    ]


def _weighted_fast_queue_targets(*, batched_fast_count: int, single_fast_count: int) -> list[tuple[str, int]]:
    targets: list[tuple[str, int]] = []
    if batched_fast_count > 0:
        targets.append(("batched_fast", max(1, batched_fast_count)))
    if single_fast_count > 0:
        targets.append(("single_fast", max(1, single_fast_count)))
    return targets


def _distribute_extra_workers(remaining_after_floor: int, fast_targets: list[tuple[str, int]]) -> dict[str, int]:
    total_fast_batches = sum(count for _, count in fast_targets)
    if remaining_after_floor <= 0 or total_fast_batches <= 0:
        return {name: 0 for name, _count in fast_targets}
    extras: dict[str, int] = {}
    assigned = 0
    for index, (name, count) in enumerate(fast_targets):
        extra = (
            remaining_after_floor - assigned
            if index == len(fast_targets) - 1
            else (remaining_after_floor * count) // total_fast_batches
        )
        assigned += extra
        extras[name] = extra
    return extras


def _allocate_translation_queue_workers(
    total_workers: int,
    *,
    batched_fast_count: int,
    single_fast_count: int,
    single_slow_count: int,
    slow_worker_limit: int | None = None,
) -> dict[str, int]:
    workers = max(1, total_workers)
    allocation = _empty_worker_allocation()
    if workers == 1:
        return _single_worker_allocation(
            batched_fast_count=batched_fast_count,
            single_fast_count=single_fast_count,
            single_slow_count=single_slow_count,
        )

    fast_targets = _fast_queue_targets(
        batched_fast_count=batched_fast_count,
        single_fast_count=single_fast_count,
    )
    fast_queue_floor = len(fast_targets)

    if single_slow_count > 0:
        slow_cap = _slow_worker_cap(workers, single_slow_count) if slow_worker_limit is None else max(0, int(slow_worker_limit))
        slow_capacity = workers if not fast_targets else max(0, workers - fast_queue_floor)
        allocation["single_slow"] = min(single_slow_count, slow_cap, slow_capacity)

    remaining = workers - allocation["single_slow"]

    if not fast_targets:
        allocation["single_slow"] = workers
        return allocation
    if len(fast_targets) == 1:
        allocation[fast_targets[0][0]] = remaining
        return allocation

    remaining_after_floor = remaining - len(fast_targets)
    for name, _count in fast_targets:
        allocation[name] = 1
    weighted_targets = _weighted_fast_queue_targets(
        batched_fast_count=batched_fast_count,
        single_fast_count=single_fast_count,
    )
    for name, extra in _distribute_extra_workers(remaining_after_floor, weighted_targets).items():
        allocation[name] += extra
    return allocation


__all__ = [
    "adaptive_floor_limit",
    "adaptive_initial_limit",
    "provider_adaptive_initial_limit",
    "_adaptive_floor_limit",
    "_adaptive_initial_limit",
    "DEEPSEEK_ADAPTIVE_INITIAL_LIMIT_ENV",
    "_provider_adaptive_initial_limit",
    "_allocate_translation_queue_workers",
    "_distribute_extra_workers",
    "_empty_worker_allocation",
    "_fast_queue_targets",
    "_weighted_fast_queue_targets",
    "_single_worker_allocation",
    "_slow_worker_cap",
]
