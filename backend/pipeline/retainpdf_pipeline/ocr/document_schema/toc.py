from __future__ import annotations

import re

TOC_LINE_WITH_LEADER_RE = re.compile(
    r"^\s*(?:(?P<number>(?:[A-Z]|\d+)(?:\.\d+)*\.?)\s+)?"
    r"(?P<title>.+?)"
    r"(?:\s*(?P<leader>\.{2,}|…+)\s*|\s{2,})"
    r"(?P<page>[ivxlcdmIVXLCDM]+|\d+[A-Za-z]?)\s*$"
)

NUMBERED_TOC_LINE_RE = re.compile(
    r"^\s*(?P<number>(?:[A-Z]|\d+)(?:\.\d+)*\.?)\s+"
    r"(?P<title>.+?)\s+"
    r"(?P<page>[ivxlcdmIVXLCDM]+|\d+[A-Za-z]?)\s*$"
)

MIN_COLUMN_GAP_PT = 32.0


def parse_toc_line(text: str) -> dict | None:
    raw = " ".join(str(text or "").split()).strip()
    if not raw:
        return None
    match = TOC_LINE_WITH_LEADER_RE.match(raw) or NUMBERED_TOC_LINE_RE.match(raw)
    if match is None:
        return None
    title = str(match.group("title") or "").strip(" .\t")
    page_label = str(match.group("page") or "").strip()
    if not title or not page_label:
        return None
    number = str(match.group("number") or "").strip()
    level = 1
    if number:
        level = max(1, min(6, number.rstrip(".").count(".") + 1))
    return {
        "number": number,
        "title": title,
        "page_label": page_label,
        "level": level,
    }


def _coerce_bbox(value: object) -> list[float] | None:
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        bbox = [float(v) for v in value]
    except (TypeError, ValueError):
        return None
    if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
        return None
    return bbox


def _line_bbox(line: object) -> list[float] | None:
    if not isinstance(line, dict):
        return None
    bbox = _coerce_bbox(line.get("bbox"))
    if bbox is not None:
        return bbox
    spans = line.get("spans") or []
    span_boxes = [
        box
        for span in spans
        if isinstance(span, dict)
        for box in [_coerce_bbox(span.get("bbox"))]
        if box is not None
    ]
    if not span_boxes:
        return None
    return [
        min(box[0] for box in span_boxes),
        min(box[1] for box in span_boxes),
        max(box[2] for box in span_boxes),
        max(box[3] for box in span_boxes),
    ]


def _column_groups(indexed_lines: list[tuple[int, str, dict, list[float]]]) -> list[list[tuple[int, str, dict, list[float]]]]:
    ordered = sorted(indexed_lines, key=lambda item: (item[3][0], item[3][1], item[0]))
    columns: list[list[tuple[int, str, dict, list[float]]]] = []
    for item in ordered:
        bbox = item[3]
        center_x = (bbox[0] + bbox[2]) / 2.0
        best_index = -1
        best_distance = float("inf")
        for index, column in enumerate(columns):
            column_centers = [(entry[3][0] + entry[3][2]) / 2.0 for entry in column]
            column_center = sum(column_centers) / len(column_centers)
            distance = abs(center_x - column_center)
            if distance < best_distance:
                best_distance = distance
                best_index = index
        if best_index >= 0 and best_distance <= MIN_COLUMN_GAP_PT:
            columns[best_index].append(item)
        else:
            columns.append([item])
    return sorted(columns, key=lambda column: min(entry[3][0] for entry in column))


def order_toc_lines_by_geometry(*, lines: list[dict], line_texts: list[str]) -> list[tuple[int, str, dict]]:
    indexed: list[tuple[int, str, dict, list[float]]] = []
    fallback: list[tuple[int, str, dict]] = []
    for index, text in enumerate(line_texts):
        line = lines[index] if index < len(lines) and isinstance(lines[index], dict) else {}
        bbox = _line_bbox(line)
        if bbox is None:
            fallback.append((index, str(text), line))
            continue
        indexed.append((index, str(text), line, bbox))
    if not indexed:
        return fallback
    columns = _column_groups(indexed)
    ordered = [
        (index, text, line)
        for column in columns
        for index, text, line, _bbox in sorted(column, key=lambda item: (item[3][1], item[3][0], item[0]))
    ]
    if fallback:
        ordered.extend(fallback)
    return ordered


def build_toc_entries(*, lines: list[dict], line_texts: list[str]) -> list[dict]:
    entries: list[dict] = []
    for order, (index, text, line) in enumerate(order_toc_lines_by_geometry(lines=lines, line_texts=line_texts)):
        parsed = parse_toc_line(text)
        if parsed is None:
            continue
        bbox = _line_bbox(line)
        parsed["line_index"] = index
        parsed["order_index"] = order
        if isinstance(bbox, list) and len(bbox) == 4:
            parsed["bbox"] = bbox
        entries.append(parsed)
    return entries


__all__ = ["build_toc_entries", "order_toc_lines_by_geometry", "parse_toc_line"]
