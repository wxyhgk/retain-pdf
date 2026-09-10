from __future__ import annotations

import re

TOKEN_RE = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
INLINE_MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
MATH_AWARE_TOKEN_RE = re.compile(
    rf"(<[futnvc]\d+-[0-9a-z]{{3}}/>|\[\[FORMULA_\d+]]|\s+|{INLINE_MATH_SPAN_RE.pattern}|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)"
)
SPLIT_PUNCTUATION = "。！？；，、,.!?;:)]}）】」』"


def math_spans(text: str) -> list[str]:
    return [match.group(0).strip() for match in INLINE_MATH_SPAN_RE.finditer(str(text or "")) if match.group(0).strip()]


def token_units(token: str) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return 0.2
    if token.startswith("<") or token.startswith("[[FORMULA_"):
        return 3.0
    if re.fullmatch(r"[A-Za-z0-9_\-./]+", token):
        return max(1.0, len(token) * 0.55)
    return 1.0


def text_units(text: str) -> float:
    return sum(token_units(token) for token in TOKEN_RE.findall(str(text or "")))


def tokenize_group_translation(text: str) -> list[str]:
    return MATH_AWARE_TOKEN_RE.findall(str(text or "").strip())


def join_tokens(tokens: list[str]) -> str:
    return "".join(tokens).strip()


def split_group_protected_translation(protected_text: str, items: list[dict]) -> list[str]:
    if len(items) <= 1:
        return [str(protected_text or "").strip()]
    tokens = tokenize_group_translation(protected_text)
    if not tokens:
        return [""] * len(items)

    token_costs = [token_units(token) for token in tokens]
    total_cost = sum(token_costs)
    if total_cost <= 0:
        return [join_tokens(tokens)] + [""] * (len(items) - 1)

    source_weights = [
        max(1.0, text_units(item.get("protected_source_text") or item.get("source_text") or ""))
        for item in items
    ]
    total_source_weight = max(1.0, sum(source_weights))

    chunks: list[str] = []
    cursor = 0
    cumulative_target_cost = 0.0
    source_seen = 0.0
    for index, weight in enumerate(source_weights[:-1]):
        source_seen += weight
        target_cost = total_cost * source_seen / total_source_weight
        cumulative = cumulative_target_cost
        anchor = cursor + 1
        while anchor < len(tokens) - (len(source_weights) - index - 1) and cumulative < target_cost:
            cumulative += token_costs[anchor - 1]
            anchor += 1

        left = max(cursor + 1, anchor - 36)
        right = min(len(tokens) - (len(source_weights) - index - 1), anchor + 36)
        best = anchor
        best_score = None
        for probe in range(left, right + 1):
            if probe <= cursor:
                continue
            probe_cost = cumulative_target_cost + sum(token_costs[cursor:probe])
            score = abs(probe_cost - target_cost)
            prev = tokens[probe - 1].rstrip() if probe - 1 < len(tokens) else ""
            if prev.endswith(SPLIT_PUNCTUATION):
                score -= 2.0
            if best_score is None or score < best_score:
                best = probe
                best_score = score

        chunks.append(join_tokens(tokens[cursor:best]))
        cumulative_target_cost += sum(token_costs[cursor:best])
        cursor = best

    chunks.append(join_tokens(tokens[cursor:]))
    while len(chunks) < len(items):
        chunks.append("")
    return chunks[: len(items)]


__all__ = [
    "INLINE_MATH_SPAN_RE",
    "math_spans",
    "split_group_protected_translation",
    "text_units",
    "token_units",
]
