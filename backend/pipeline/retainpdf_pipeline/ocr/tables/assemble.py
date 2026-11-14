"""把文字层的行、词对到 OCR 的逻辑网格上：哪几行文字属于第几行表格、每个词落在哪一列。

1. 行：动态规划。一行表格可以占好几行文字（格子里换行），OCR 多出来的行（把表题当成一行）可以不占文字，
   框里不属于任何一行的文字（漏进框的表题、表注）可以跳过。相似度用 OCR 文字和文字层的词比（只用来对齐，文字不取 OCR 的）。
2. 列：找竖向的空白通道（几乎所有行都没有字的横坐标区间），取最宽的 列数-1 条，列界在通道中间。
3. 格子：落在格子覆盖的行（含 rowspan）和列（含 colspan）里的词，按行、从左到右拼起来。
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

from .html_grid import GridCell, HtmlGrid
from .text_layer import TextLine, Word

_MAX_LINES_PER_ROW = 8
_SKIP_LINE_PENALTY = 0.35
_EMPTY_ROW_PENALTY = 0.6
_DASHES = dict.fromkeys(map(ord, "‐‑‒–—―−一"), "-")


def _tokens(text: str) -> Counter:
    text = re.sub(r"<[^>]+>", "", text)
    text = unicodedata.normalize("NFKC", text).translate(_DASHES).lower()
    return Counter(re.findall(r"[a-z]+|\d+(?:\.\d+)?|[^\sa-z\d]", text))


def _similarity(left: Counter, right: Counter) -> float:
    left_total, right_total = sum(left.values()), sum(right.values())
    return _similarity_counts(left, left_total, right, right_total)


def _similarity_counts(left: dict, left_total: int, right: dict, right_total: int) -> float:
    if not left_total and not right_total:
        return 1.0
    if not left_total or not right_total:
        return 0.0
    small, large = (left, right) if len(left) <= len(right) else (right, left)
    common = 0
    for token, count in small.items():
        other = large.get(token)
        if other:
            common += count if count < other else other
    return common / (left_total if left_total > right_total else right_total)


@dataclass
class RowMapping:
    row_lines: list[list[int]]  # 第 r 行表格占了哪几行文字（下标）
    skipped_lines: list[int]
    matched_rows: int  # 相似度不低的行数


def map_rows(grid: HtmlGrid, lines: list[TextLine]) -> RowMapping:
    row_tokens = [
        sum((_tokens(cell.ocr_text) for cell in row), Counter()) for row in grid.rows()
    ]
    line_tokens = [_tokens(line.text) for line in lines]
    n, m = len(lines), len(row_tokens)
    row_totals = [sum(tokens.values()) for tokens in row_tokens]
    # 第 i 行文字起、连着 k 行合起来的词频（和表格的第几行无关，只算一次）
    merged_lines: list[list[tuple[Counter, int]]] = []
    for i in range(n):
        merged: Counter = Counter()
        options = []
        for k in range(1, min(_MAX_LINES_PER_ROW, n - i) + 1):
            merged = merged + line_tokens[i + k - 1]
            options.append((merged, sum(merged.values())))
        merged_lines.append(options)
    negative = float("-inf")
    best = [[negative] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[str, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if best[i][j] == negative:
                continue
            here = best[i][j]
            if i < n and here - _SKIP_LINE_PENALTY > best[i + 1][j]:  # 这行文字不属于表格的任何一行
                best[i + 1][j] = here - _SKIP_LINE_PENALTY
                back[i + 1][j] = ("skip", 1)
            if j < m and here - _EMPTY_ROW_PENALTY > best[i][j + 1]:  # 这行表格没有文字（OCR 多认的行）
                best[i][j + 1] = here - _EMPTY_ROW_PENALTY
                back[i][j + 1] = ("empty", 0)
            if j < m and i < n:
                for k, (merged, merged_total) in enumerate(merged_lines[i], start=1):
                    similarity = _similarity_counts(row_tokens[j], row_totals[j], merged, merged_total)
                    score = here + similarity * (1 + 0.05 * (k == 1))
                    if score > best[i + k][j + 1]:
                        best[i + k][j + 1] = score
                        back[i + k][j + 1] = ("take", k)
    row_lines: list[list[int]] = [[] for _ in range(m)]
    skipped: list[int] = []
    i, j = n, m
    while i > 0 or j > 0:
        step = back[i][j]
        if step is None:
            break
        kind, k = step
        if kind == "skip":
            skipped.append(i - 1)
            i -= 1
        elif kind == "empty":
            j -= 1
        else:
            row_lines[j - 1] = list(range(i - k, i))
            i -= k
            j -= 1
    matched = sum(
        1
        for row_index, indexes in enumerate(row_lines)
        if indexes
        and _similarity(row_tokens[row_index], sum((line_tokens[index] for index in indexes), Counter())) >= 0.5
    )
    return RowMapping(row_lines=row_lines, skipped_lines=sorted(skipped), matched_rows=matched)


def _split_by_gaps(words: list[Word], parts: int) -> list[list[Word]] | None:
    words = sorted(words, key=lambda word: word.x0)
    if parts <= 0 or len(words) < parts:
        return None
    if parts == 1:
        return [words]
    gaps = sorted(
        ((words[index + 1].x0 - words[index].x1, index) for index in range(len(words) - 1)),
        reverse=True,
    )[: parts - 1]
    cuts = sorted(index for _, index in gaps)
    groups, start = [], 0
    for cut in cuts:
        groups.append(words[start : cut + 1])
        start = cut + 1
    groups.append(words[start:])
    return groups


def _phrases(line: TextLine) -> list[tuple[float, float]]:
    """一行里挨得近的词并成词组（词组内的空隙比列间距小得多），返回各词组的左右边界。"""
    words = sorted(line.words, key=lambda word: word.x0)
    if not words:
        return []
    size = sorted(word.size for word in words)[len(words) // 2] or 8.0
    spans = [[words[0].x0, words[0].x1]]
    for word in words[1:]:
        if word.x0 - spans[-1][1] < size * 0.7:
            spans[-1][1] = max(spans[-1][1], word.x1)
        else:
            spans.append([word.x0, word.x1])
    return [(left, right) for left, right in spans]


def column_bounds(grid: HtmlGrid, lines: list[TextLine], mapping: RowMapping) -> list[tuple[float, float]] | None:
    """每列的左右边界；推不出来返回 None。

    找"竖向空白通道"：统计横坐标上每一处被多少行的词组盖住，几乎所有行都空着的地方是列间的缝。
    取最宽的 列数-1 条缝，列界在缝的中间。表头常跨列，少数行盖住缝也不影响。
    """
    if grid.n_cols <= 1:
        return [(float("-inf"), float("inf"))]
    used = [index for indexes in mapping.row_lines for index in indexes]
    if not used:
        return None
    phrase_rows = [_phrases(lines[index]) for index in used]
    left = min(span[0] for row in phrase_rows for span in row)
    right = max(span[1] for row in phrase_rows for span in row)
    width = int(right - left) + 1
    if width <= 2:
        return None
    coverage = [0] * width
    for row in phrase_rows:
        covered = [False] * width
        for x0, x1 in row:
            for x in range(int(x0 - left), min(width, int(x1 - left) + 1)):
                covered[x] = True
        for x, flag in enumerate(covered):
            coverage[x] += flag
    limit = max(1, int(len(phrase_rows) * 0.12))
    corridors: list[tuple[int, int, int]] = []  # (宽度, 起点, 终点)
    x = 0
    while x < width:
        if coverage[x] <= limit:
            start = x
            while x < width and coverage[x] <= limit:
                x += 1
            if start > 0 and x < width:  # 两边都有字才算列间缝
                emptiness = sum(limit + 1 - coverage[i] for i in range(start, x))
                corridors.append((emptiness, start, x))
        else:
            x += 1
    if len(corridors) < grid.n_cols - 1:
        return _bounds_from_full_rows(grid, lines, mapping)
    chosen = sorted(sorted(corridors, reverse=True)[: grid.n_cols - 1], key=lambda item: item[1])
    cuts = [left + (start + end) / 2 for _, start, end in chosen]
    edges = [float("-inf"), *cuts, float("inf")]
    return [(edges[index], edges[index + 1]) for index in range(grid.n_cols)]


def _bounds_from_full_rows(
    grid: HtmlGrid, lines: list[TextLine], mapping: RowMapping
) -> list[tuple[float, float]] | None:
    """退路：空白通道不够时，用 OCR 说"每列一格、每格都有字"的行，把这一行的词按最大的几条空隙切开，取各列的并。"""
    spans: list[list[float]] = [[float("inf"), float("-inf")] for _ in range(grid.n_cols)]
    used = 0
    for row_index, row in enumerate(grid.rows()):
        if len(row) != grid.n_cols or any(cell.colspan != 1 or not cell.ocr_text.strip() for cell in row):
            continue
        words = [word for index in mapping.row_lines[row_index] for word in lines[index].words]
        groups = _split_by_gaps(words, grid.n_cols)
        if groups is None:
            continue
        used += 1
        for column, group in enumerate(groups):
            spans[column][0] = min(spans[column][0], min(word.x0 for word in group))
            spans[column][1] = max(spans[column][1], max(word.x1 for word in group))
    if used == 0 or any(left == float("inf") for left, _ in spans):
        return None
    bounds: list[tuple[float, float]] = []
    for column, (left, right) in enumerate(spans):
        start = float("-inf") if column == 0 else (spans[column - 1][1] + left) / 2
        end = float("inf") if column == grid.n_cols - 1 else (right + spans[column + 1][0]) / 2
        if start >= end:
            return None
        bounds.append((start, end))
    return bounds


def _column_of(word: Word, bounds: list[tuple[float, float]]) -> int:
    for index, (start, end) in enumerate(bounds):
        if start <= word.cx < end:
            return index
    return len(bounds) - 1


def assign_cells(
    grid: HtmlGrid, lines: list[TextLine], mapping: RowMapping, bounds: list[tuple[float, float]]
) -> dict[tuple[int, int], list[Word]]:
    """每个格子（按起始行列）落进来的词，按行、从左到右。"""
    owner: dict[tuple[int, int], GridCell] = {}
    for cell in grid.cells:
        for dr in range(cell.rowspan):
            for dc in range(cell.colspan):
                owner[(cell.row + dr, cell.col + dc)] = cell
    words_of: dict[tuple[int, int], list[Word]] = {(cell.row, cell.col): [] for cell in grid.cells}
    for row_index, indexes in enumerate(mapping.row_lines):
        for line_index in indexes:
            for word in lines[line_index].words:
                cell = owner.get((row_index, _column_of(word, bounds)))
                if cell is not None:
                    words_of[(cell.row, cell.col)].append(word)
    return words_of
