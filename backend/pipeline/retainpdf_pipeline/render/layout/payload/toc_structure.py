from __future__ import annotations

import re

from retainpdf_pipeline.render.semantics.toc import build_toc_entries
from retainpdf_pipeline.render.semantics.toc import order_toc_lines_by_geometry
from retainpdf_pipeline.render.layout.model.models import RenderTocEntry

TRANSLATED_TOC_LINE_RE = re.compile(
    r"^\s*(?P<title>.+?)"
    r"(?:\s*(?:\.{2,}|…+)\s*|\s+)"
    r"\(?(?P<page>\d+[A-Za-z]?|[ivxlcdmIVXLCDM]+)\)?\s*$"
)
PAREN_PAGE_SUFFIX_RE = re.compile(r"^\s*(?P<title>.+?)\s*\((?P<page>\d+[A-Za-z]?|[ivxlcdmIVXLCDM]+)\)\s*$")


def _translated_lines(text: str) -> list[str]:
    return [line.strip() for line in str(text or "").splitlines() if line.strip()]


def _translated_lines_by_source_geometry(item: dict, translated_text: str) -> list[str]:
    lines = _translated_lines(translated_text)
    source_lines = item.get("source_line_texts") or []
    source_line_boxes = item.get("lines") or []
    if not isinstance(source_lines, list) or not isinstance(source_line_boxes, list):
        return lines
    if len(lines) != len(source_lines):
        return lines
    ordered = order_toc_lines_by_geometry(
        lines=source_line_boxes,
        line_texts=[str(line) for line in source_lines],
    )
    if len(ordered) != len(lines):
        return lines
    return [lines[index] for index, _text, _line in ordered]


def _strip_toc_page_label(text: str, page_label: str) -> str:
    value = str(text or "").strip()
    page = re.escape(str(page_label or "").strip())
    if page:
        value = re.sub(rf"(?:\.{{2,}}|…+)?\s*\(?{page}\)?\s*$", "", value).strip()
    return value.strip(" .\t")


def _strip_toc_number(text: str, number: str) -> str:
    value = str(text or "").strip()
    number_text = str(number or "").strip()
    if number_text and value.startswith(number_text):
        return value[len(number_text) :].strip()
    return value


def _bbox_from_line(item: dict, entry: dict) -> list[float] | None:
    try:
        line_index = int(entry.get("line_index"))
    except (TypeError, ValueError):
        return None
    lines = item.get("lines") or []
    if line_index < 0 or line_index >= len(lines):
        return None
    line = lines[line_index]
    if not isinstance(line, dict):
        return None
    bbox = line.get("bbox")
    if not isinstance(bbox, list) or len(bbox) != 4:
        return None
    try:
        line_bbox = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None
    if line_bbox[2] <= line_bbox[0] or line_bbox[3] <= line_bbox[1]:
        return None
    return line_bbox


def _bbox_from_entry(entry: dict) -> list[float] | None:
    bbox = entry.get("bbox")
    if not isinstance(bbox, list) or len(bbox) != 4:
        return None
    try:
        line_bbox = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None
    if line_bbox[2] <= line_bbox[0] or line_bbox[3] <= line_bbox[1]:
        return None
    return line_bbox


def _fallback_toc_entries(item: dict) -> list[dict]:
    structure_role = str(item.get("structure_role") or "").strip().lower()
    semantic_role = str(item.get("semantic_role") or item.get("layout_role") or "").strip().lower()
    if structure_role != "table_of_contents" and semantic_role != "table_of_contents":
        return []
    line_texts = item.get("source_line_texts") or []
    lines = item.get("lines") or []
    if not isinstance(line_texts, list) or not isinstance(lines, list):
        return []
    return build_toc_entries(lines=lines, line_texts=[str(line) for line in line_texts])


def _toc_line_count(item: dict) -> int:
    line_texts = item.get("source_line_texts") or []
    if isinstance(line_texts, list) and line_texts:
        return len([line for line in line_texts if str(line or "").strip()])
    lines = item.get("lines") or []
    if isinstance(lines, list):
        return len(lines)
    return 0


def _should_rebuild_partial_toc_entries(item: dict, entries: list[dict]) -> bool:
    if not entries:
        return False
    line_count = _toc_line_count(item)
    return line_count > 0 and len(entries) < line_count


def _line_bbox(item: dict, index: int) -> list[float] | None:
    lines = item.get("lines") or []
    if not isinstance(lines, list) or index < 0 or index >= len(lines):
        return None
    line = lines[index]
    if not isinstance(line, dict):
        return None
    return _coerce_bbox(line.get("bbox"))


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


def _split_translated_toc_line(line: str) -> tuple[str, str]:
    value = str(line or "").strip()
    if not value:
        return "", ""
    match = PAREN_PAGE_SUFFIX_RE.match(value) or TRANSLATED_TOC_LINE_RE.match(value)
    if match is None:
        return value.strip(" .\t"), ""
    title = str(match.group("title") or "").strip(" .\t")
    page_label = str(match.group("page") or "").strip()
    return title, page_label


def _render_toc_entries_from_translated_lines(item: dict, translated_text: str) -> list[RenderTocEntry]:
    structure_role = str(item.get("structure_role") or "").strip().lower()
    semantic_role = str(item.get("semantic_role") or item.get("layout_role") or "").strip().lower()
    if structure_role != "table_of_contents" and semantic_role != "table_of_contents":
        return []
    rendered: list[RenderTocEntry] = []
    for index, line in enumerate(_translated_lines_by_source_geometry(item, translated_text)):
        bbox = _line_bbox(item, index)
        if bbox is None:
            continue
        title, page_label = _split_translated_toc_line(line)
        if not title:
            continue
        rendered.append(RenderTocEntry(title=title, page_label=page_label, bbox=bbox, number="", level=1))
    return rendered


def render_toc_entries_for_item(item: dict, translated_text: str) -> list[RenderTocEntry]:
    entries = item.get("toc_entries") or _fallback_toc_entries(item)
    if isinstance(entries, list) and _should_rebuild_partial_toc_entries(item, entries):
        rebuilt_entries = _fallback_toc_entries(item)
        if len(rebuilt_entries) > len(entries):
            entries = rebuilt_entries
    if not isinstance(entries, list) or not entries:
        return _render_toc_entries_from_translated_lines(item, translated_text)
    lines = _translated_lines_by_source_geometry(item, translated_text)
    rendered: list[RenderTocEntry] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        line_bbox = _bbox_from_line(item, entry) or _bbox_from_entry(entry)
        if line_bbox is None:
            continue
        source_title = str(entry.get("title") or "").strip()
        page_label = str(entry.get("page_label") or "").strip()
        number = str(entry.get("number") or "").strip()
        translated_line = lines[index] if index < len(lines) else ""
        title = _strip_toc_number(_strip_toc_page_label(translated_line, page_label), number) or source_title
        try:
            level = int(entry.get("level") or 1)
        except (TypeError, ValueError):
            level = 1
        rendered.append(
            RenderTocEntry(
                title=title,
                page_label=page_label,
                bbox=line_bbox,
                number=number,
                level=max(1, min(6, level)),
            )
        )
    return rendered


__all__ = ["render_toc_entries_for_item"]
