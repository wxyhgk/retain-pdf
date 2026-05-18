from __future__ import annotations


def quantile(sorted_values: list[int], numerator: int, denominator: int) -> int:
    if not sorted_values:
        return 255
    index = int(round((len(sorted_values) - 1) * numerator / denominator))
    index = max(0, min(len(sorted_values) - 1, index))
    return sorted_values[index]
