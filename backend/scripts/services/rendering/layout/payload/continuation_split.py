from __future__ import annotations

import re

from services.rendering.layout.payload.formula_cost import token_units
from services.rendering.layout.payload.text_common import SPLIT_PUNCTUATION
from services.rendering.layout.payload.text_common import tokenize_protected_text
from services.rendering.layout.payload.text_common import trim_joined_tokens


CONTINUATION_REBALANCE_MAX_PASSES = 3
CONTINUATION_REBALANCE_TOKEN_WINDOW = 80
CONTINUATION_REBALANCE_TARGET_TOLERANCE = 3.5
CONTINUATION_REBALANCE_IMBALANCE_TRIGGER = 12.0
CONTINUATION_REBALANCE_PUNCTUATION_PENALTY = 1.75
CONTINUATION_REBALANCE_NON_PUNCT_MIN_MOVE_UNITS = 18.0
DIRECT_INLINE_MATH_TOKEN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$|\s+|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|[\u4e00-\u9fff]|.")


def _tokenize_for_continuation_split(text: str, *, direct_math_mode: bool) -> list[str]:
    if not direct_math_mode:
        return tokenize_protected_text(text)
    return [token for token in DIRECT_INLINE_MATH_TOKEN_RE.findall(text or "") if token]


def _range_cost(prefix_costs: list[float], start: int, end: int) -> float:
    return prefix_costs[end] - prefix_costs[start]


def _probe_has_split_punctuation(tokens: list[str], start: int, end: int) -> bool:
    probe = end - 1
    while probe >= start and tokens[probe].isspace():
        probe -= 1
    if probe < start:
        return False
    return tokens[probe].endswith(SPLIT_PUNCTUATION)


def _trim_range_edges(tokens: list[str], start: int, end: int) -> tuple[int, int]:
    while start < end and tokens[start].isspace():
        start += 1
    while end > start and tokens[end - 1].isspace():
        end -= 1
    return start, end


def _range_text(tokens: list[str], start: int, end: int) -> str:
    start, end = _trim_range_edges(tokens, start, end)
    return trim_joined_tokens(tokens[start:end])


def _candidate_rebalance_positions(
    tokens: list[str],
    prefix_costs: list[float],
    *,
    start: int,
    end: int,
    ideal_end: int,
) -> list[int]:
    del prefix_costs
    positions: set[int] = set()
    left = max(start + 1, ideal_end - CONTINUATION_REBALANCE_TOKEN_WINDOW)
    right = min(end - 1, ideal_end + CONTINUATION_REBALANCE_TOKEN_WINDOW)
    for probe in range(left, right + 1):
        positions.add(probe)
    for probe in range(start + 1, end):
        if _probe_has_split_punctuation(tokens, start, probe):
            positions.add(probe)
    positions.add(start + 1)
    positions.add(end - 1)
    return sorted(position for position in positions if start < position < end)


def _rebalance_chunk_ranges(
    tokens: list[str],
    prefix_costs: list[float],
    capacities: list[float],
    ranges: list[tuple[int, int]],
) -> list[tuple[int, int]]:
    if len(ranges) <= 1:
        return ranges

    normalized_capacities = [max(1.0, value) for value in capacities]
    rebalanced = list(ranges)
    for _ in range(CONTINUATION_REBALANCE_MAX_PASSES):
        changed = False
        for index in range(len(rebalanced) - 1):
            left_start, left_end = rebalanced[index]
            right_start, right_end = rebalanced[index + 1]
            if left_start >= left_end or right_start >= right_end:
                continue

            left_cost = _range_cost(prefix_costs, left_start, left_end)
            right_cost = _range_cost(prefix_costs, right_start, right_end)
            combined_cost = left_cost + right_cost
            if combined_cost <= 0:
                continue

            left_target = combined_cost * normalized_capacities[index] / (
                normalized_capacities[index] + normalized_capacities[index + 1]
            )
            imbalance = left_cost - left_target
            if imbalance <= CONTINUATION_REBALANCE_IMBALANCE_TRIGGER:
                continue

            left_ratio = left_cost / normalized_capacities[index]
            right_ratio = right_cost / normalized_capacities[index + 1]
            if left_ratio <= right_ratio + 0.08:
                continue

            cumulative = 0.0
            ideal_probe = left_end - 1
            for probe in range(left_end - 1, left_start, -1):
                cumulative += token_units(tokens[probe], {})
                if cumulative >= imbalance:
                    ideal_probe = probe
                    break

            best_probe = None
            best_score = None
            for probe in _candidate_rebalance_positions(
                tokens,
                prefix_costs,
                start=left_start,
                end=left_end,
                ideal_end=ideal_probe,
            ):
                moved_cost = _range_cost(prefix_costs, probe, left_end)
                if moved_cost <= 0:
                    continue
                if (
                    moved_cost < CONTINUATION_REBALANCE_NON_PUNCT_MIN_MOVE_UNITS
                    and not _probe_has_split_punctuation(tokens, left_start, probe)
                ):
                    continue

                next_left_cost = _range_cost(prefix_costs, left_start, probe)
                next_right_cost = _range_cost(prefix_costs, probe, left_end) + right_cost
                target_delta = abs(next_left_cost - left_target)
                ratio_delta = abs(
                    (next_left_cost / normalized_capacities[index])
                    - (next_right_cost / normalized_capacities[index + 1])
                )
                punctuation_penalty = (
                    0.0 if _probe_has_split_punctuation(tokens, left_start, probe) else CONTINUATION_REBALANCE_PUNCTUATION_PENALTY
                )
                score = target_delta + ratio_delta * 6.0 + punctuation_penalty
                if best_score is None or score < best_score:
                    best_score = score
                    best_probe = probe

            if best_probe is None:
                continue

            next_left_cost = _range_cost(prefix_costs, left_start, best_probe)
            if abs(next_left_cost - left_cost) <= CONTINUATION_REBALANCE_TARGET_TOLERANCE:
                continue

            rebalanced[index] = (left_start, best_probe)
            rebalanced[index + 1] = (best_probe, right_end)
            changed = True
        if not changed:
            break
    return rebalanced


def split_protected_text_for_boxes(
    protected_text: str,
    formula_map: list[dict],
    capacities: list[float],
    *,
    preferred_weights: list[float] | None = None,
    direct_math_mode: bool = False,
) -> list[str]:
    if len(capacities) <= 1:
        return [protected_text.strip()]
    tokens = _tokenize_for_continuation_split(protected_text, direct_math_mode=direct_math_mode)
    if not tokens:
        return [""] * len(capacities)
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    token_costs = [token_units(token, formula_lookup) for token in tokens]
    prefix_costs = [0.0]
    for cost in token_costs:
        prefix_costs.append(prefix_costs[-1] + cost)
    remaining_cost = sum(token_costs)
    if remaining_cost <= 0:
        return [trim_joined_tokens(tokens)] + [""] * (len(capacities) - 1)

    ranges: list[tuple[int, int]] = []
    cursor = 0
    capacity_weights = [max(1.0, capacity) for capacity in capacities]
    total_preferred = sum(max(1.0, value) for value in preferred_weights) if preferred_weights else sum(capacity_weights)
    preferred_costs = [max(1.0, value) for value in preferred_weights] if preferred_weights else capacity_weights[:]

    for box_index, capacity in enumerate(capacities):
        current_capacity = max(1.0, capacity)
        if box_index == len(capacities) - 1:
            ranges.append((cursor, len(tokens)))
            break

        remaining_boxes = len(capacities) - box_index - 1
        max_end = len(tokens) - remaining_boxes
        share = preferred_costs[box_index] / max(1.0, total_preferred)
        share_target = remaining_cost * share
        soft_target = min(share_target, current_capacity * 0.98)

        anchor = cursor + 1
        while anchor < max_end and _range_cost(prefix_costs, cursor, anchor) < soft_target:
            anchor += 1

        candidate_positions = set(range(max(cursor + 1, anchor - 24), min(max_end, anchor + 24) + 1))
        for probe in range(cursor + 1, max_end + 1):
            if _probe_has_split_punctuation(tokens, cursor, probe):
                candidate_positions.add(probe)
        candidate_positions.add(cursor + 1)
        candidate_positions.add(max_end)

        remaining_capacity_after = sum(capacity_weights[box_index + 1 :])
        best_end = cursor + 1
        best_score = None
        if remaining_capacity_after > 0 and current_capacity >= remaining_capacity_after * 2.0:
            current_overflow_weight = 28.0
            future_overflow_weight = 140.0
        else:
            current_overflow_weight = 72.0
            future_overflow_weight = 108.0
        for probe in sorted(candidate_positions):
            if probe <= cursor or probe > max_end:
                continue
            current_cost = _range_cost(prefix_costs, cursor, probe)
            future_cost = remaining_cost - current_cost
            current_overflow = max(0.0, current_cost - current_capacity * 1.01)
            future_overflow = max(0.0, future_cost - remaining_capacity_after * 1.03) if remaining_boxes else 0.0
            target_delta = abs(current_cost - share_target)
            underfill = max(0.0, current_capacity * 0.55 - current_cost)
            punctuation_penalty = 0.0 if _probe_has_split_punctuation(tokens, cursor, probe) else 1.25
            score = (
                current_overflow * current_overflow_weight
                + future_overflow * future_overflow_weight
                + target_delta
                + underfill * 0.1
                + punctuation_penalty
            )
            if best_score is None or score < best_score:
                best_score = score
                best_end = probe

        ranges.append((cursor, best_end))
        remaining_cost = max(0.0, remaining_cost - _range_cost(prefix_costs, cursor, best_end))
        total_preferred = max(1.0, total_preferred - preferred_costs[box_index])
        cursor = best_end

    while len(ranges) < len(capacities):
        ranges.append((len(tokens), len(tokens)))

    ranges = _rebalance_chunk_ranges(tokens, prefix_costs, capacities, ranges[: len(capacities)])
    chunks = [_range_text(tokens, start, end) for start, end in ranges[: len(capacities)]]
    while len(chunks) < len(capacities):
        chunks.append("")
    return chunks[: len(capacities)]
