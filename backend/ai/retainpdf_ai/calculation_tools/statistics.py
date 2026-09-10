"""Bounded deterministic statistics over finite numeric arrays."""

from __future__ import annotations

import math

from ._validation import Number, bounded_payload, require_number, require_sequence
from .errors import fail
from .limits import MAX_STATISTIC_VALUES

STATISTIC_OPERATIONS = frozenset(
    {"mean", "median", "min", "max", "sum", "count", "stddev"}
)


def _checked_values(values: object) -> list[Number]:
    sequence = require_sequence(values, what="Values")
    if len(sequence) > MAX_STATISTIC_VALUES:
        fail("value_limit_exceeded", "Too many values were provided.")
    return [require_number(value) for value in sequence]


def _sum(values: list[Number]) -> Number:
    if all(type(value) is int for value in values):
        return sum(values)
    try:
        result = math.fsum(values)
    except (OverflowError, ValueError):
        fail("numeric_limit_exceeded", "The statistic exceeds the safe numeric limit.")
    if not math.isfinite(result):
        fail("numeric_limit_exceeded", "The statistic exceeds the safe numeric limit.")
    return 0.0 if result == 0 else result


def _mean(values: list[Number]) -> float:
    return float(_sum(values) / len(values))


def _median(values: list[Number]) -> Number:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return _sum([ordered[middle - 1], ordered[middle]]) / 2


def _stddev(values: list[Number]) -> float:
    mean = _mean(values)
    try:
        variance = math.fsum((value - mean) ** 2 for value in values) / len(values)
        result = math.sqrt(variance)
    except (OverflowError, ValueError):
        fail("numeric_limit_exceeded", "The statistic exceeds the safe numeric limit.")
    if not math.isfinite(result):
        fail("numeric_limit_exceeded", "The statistic exceeds the safe numeric limit.")
    return 0.0 if result == 0 else result


def statistics_summary(values: list[Number]) -> dict[str, Number]:
    """Return every supported statistic for a known non-empty checked list."""
    return {
        "count": len(values),
        "sum": _sum(values),
        "mean": _mean(values),
        "median": _median(values),
        "min": min(values),
        "max": max(values),
        "stddev": _stddev(values),
    }


def calculate_statistics(
    values: object,
    operation: str,
) -> dict[str, object]:
    """Run one explicitly supported statistic.

    ``stddev`` is the population standard deviation.  ``count`` and ``sum``
    accept an empty array; operations that need a sample reject it.
    """
    if type(operation) is not str or operation not in STATISTIC_OPERATIONS:
        fail("unsupported_operation", "The statistics operation is not supported.")
    checked = _checked_values(values)
    if operation == "count":
        result: Number = len(checked)
    elif operation == "sum":
        result = _sum(checked)
    else:
        if not checked:
            fail(
                "empty_values",
                "This statistics operation requires at least one value.",
            )
        if operation == "mean":
            result = _mean(checked)
        elif operation == "median":
            result = _median(checked)
        elif operation == "min":
            result = min(checked)
        elif operation == "max":
            result = max(checked)
        else:
            result = _stddev(checked)
    return bounded_payload(
        {
            "schema": "retainpdf.calculation-result.v1",
            "operation": operation,
            "count": len(checked),
            "value": result,
        }
    )
