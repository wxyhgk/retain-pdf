from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Callable


@dataclass(frozen=True)
class TranslationTailItem:
    item: dict
    api_key: str
    model: str
    base_url: str
    request_label: str
    context: object
    diagnostics: object
    single_item_translator: Callable
    store_cached_batch_fn: Callable
    reason: str = "transport"
    source_route: tuple[str, ...] = ()
    attempt: int = 1
    priority: int = 100


DeferredTransportTailItem = TranslationTailItem


class TranslationTailQueue:
    def __init__(self) -> None:
        self._items: list[TranslationTailItem] = []
        self._keys: set[tuple[str, str]] = set()
        self._lock = Lock()

    def push(self, item: TranslationTailItem) -> None:
        key = _tail_item_key(item)
        with self._lock:
            if key in self._keys:
                return
            self._items.append(item)
            self._keys.add(key)

    def drain(self) -> list[TranslationTailItem]:
        with self._lock:
            items = sorted(self._items, key=lambda item: (item.priority, item.attempt))
            self._items.clear()
            self._keys.clear()
        return items

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


TransportTailRetryQueue = TranslationTailQueue


def _tail_item_key(item: TranslationTailItem) -> tuple[str, str]:
    item_id = str((item.item or {}).get("item_id", "") or "")
    reason = str(item.reason or "").strip().lower()
    return item_id, reason


def translation_tail_queue_from_context(context: object | None) -> TranslationTailQueue | None:
    if context is None:
        return None
    queue = getattr(context, "translation_tail_queue", None)
    if queue is not None:
        return queue
    return getattr(context, "transport_tail_retry_queue", None)


__all__ = [
    "DeferredTransportTailItem",
    "TranslationTailItem",
    "TranslationTailQueue",
    "TransportTailRetryQueue",
    "translation_tail_queue_from_context",
]
