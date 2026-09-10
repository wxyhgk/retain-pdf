from __future__ import annotations

from typing import Any
from typing import Protocol


class TranslationMemoryUpdater(Protocol):
    def update_from_batch(self, batch: list[dict], translated: dict[str, dict[str, Any]]) -> int: ...
    def update_many(self, updates: list[tuple[list[dict], dict[str, dict[str, Any]]]]) -> int: ...
    def flush(self) -> None: ...


class NullTranslationMemoryUpdater:
    def update_from_batch(self, batch: list[dict], translated: dict[str, dict[str, Any]]) -> int:
        return 0

    def update_many(self, updates: list[tuple[list[dict], dict[str, dict[str, Any]]]]) -> int:
        return 0

    def flush(self) -> None:
        return None


def update_translation_memory(
    updater: TranslationMemoryUpdater | None,
    *,
    batch: list[dict],
    translated: dict[str, dict[str, Any]],
) -> int:
    if updater is None:
        return 0
    return updater.update_from_batch(batch, translated)


def update_translation_memory_many(
    updater: TranslationMemoryUpdater | None,
    updates: list[tuple[list[dict], dict[str, dict[str, Any]]]],
) -> int:
    if updater is None or not updates:
        return 0
    update_many = getattr(updater, "update_many", None)
    if callable(update_many):
        return int(update_many(updates) or 0)
    changed = 0
    for batch, translated in updates:
        changed += int(updater.update_from_batch(batch, translated) or 0)
    return changed


def flush_translation_memory(updater: TranslationMemoryUpdater | None) -> None:
    if updater is None:
        return
    flush = getattr(updater, "flush", None)
    if callable(flush):
        flush()


__all__ = [
    "NullTranslationMemoryUpdater",
    "TranslationMemoryUpdater",
    "flush_translation_memory",
    "update_translation_memory_many",
    "update_translation_memory",
]
