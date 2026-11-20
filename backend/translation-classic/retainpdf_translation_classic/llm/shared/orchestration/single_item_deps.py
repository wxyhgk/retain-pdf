from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class SingleItemFlowDeps:
    translate_plain_fn: Callable
    translate_unstructured_fn: Callable
    formula_segment_translator_fn: Callable
    stable_placeholder_text_fn: Callable
    sentence_level_fallback_fn: Callable
    validate_batch_result_fn: Callable
    single_item_translator_fn: Callable | None = None


__all__ = [
    "SingleItemFlowDeps",
]
