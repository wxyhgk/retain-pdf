from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


PlainTextResult = dict[str, dict[str, str]]


@dataclass(frozen=True)
class PlainTextRetryRuntime:
    translate_plain_fn: Callable[..., PlainTextResult]
    translate_unstructured_fn: Callable[..., PlainTextResult]
    tagged_placeholder_path_fn: Callable[..., PlainTextResult]
    sentence_level_fallback_fn: Callable[..., PlainTextResult]
    canonicalize_batch_result_fn: Callable[..., PlainTextResult]
    validate_batch_result_fn: Callable[..., None]
    unwrap_translation_shell_fn: Callable[..., str]
    log_placeholder_failure_fn: Callable[..., None]
    is_transport_error_fn: Callable[[Exception], bool]
