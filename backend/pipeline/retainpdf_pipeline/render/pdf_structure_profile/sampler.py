from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.pdf_structure_profile.contracts import PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfObjectBox
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureItemHit
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructurePageProfile
from retainpdf_pipeline.render.pdf_structure_profile.contracts import bbox_from_rect
from retainpdf_pipeline.render.source.rects import rect_area
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import BBOX_COORDINATE_CANDIDATES
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import TextRectIndex
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import bboxlog_kind
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import bboxlog_rect
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import choose_page_coordinate_candidate
from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import raw_bbox_rect
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import bboxlog_path_blocks_text_strip


MIN_ITEM_TEXT_OBJECT_OVERLAP_RATIO = 0.2


def build_pdf_structure_profile(
    source_pdf_path: Path,
    pages: dict[int, list[dict]] | None = None,
) -> PdfStructureDocumentProfile:
    doc = fitz.open(source_pdf_path)
    try:
        page_profiles: dict[int, PdfStructurePageProfile] = {}
        page_items = pages or {index: [] for index in range(len(doc))}
        for page_index, items in page_items.items():
            if 0 <= page_index < len(doc):
                page_profiles[page_index] = build_pdf_structure_page_profile(doc[page_index], items)
        return PdfStructureDocumentProfile(
            algorithm=PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION,
            pages=page_profiles,
        )
    finally:
        doc.close()


def build_pdf_structure_page_profile(
    page: fitz.Page,
    items: list[dict] | None = None,
) -> PdfStructurePageProfile:
    text_objects, image_objects, path_objects = _bboxlog_objects(page)
    text_spans = _text_span_objects(page)
    form_xobjects = _form_xobject_objects(page)
    item_hits = _item_hits(page, items or [], text_objects)
    return PdfStructurePageProfile(
        page_index=int(page.number),
        page_width_pt=float(page.rect.width),
        page_height_pt=float(page.rect.height),
        text_objects=tuple(text_objects),
        text_spans=tuple(text_spans),
        path_objects=tuple(path_objects),
        image_objects=tuple(image_objects),
        form_xobjects=tuple(form_xobjects),
        item_hits=tuple(item_hits),
    )


def _bboxlog_objects(page: fitz.Page) -> tuple[list[PdfObjectBox], list[PdfObjectBox], list[PdfObjectBox]]:
    try:
        bboxlog = page.get_bboxlog()
    except Exception:
        return [], [], []
    text_objects: list[PdfObjectBox] = []
    image_objects: list[PdfObjectBox] = []
    path_objects: list[PdfObjectBox] = []
    for index, entry in enumerate(bboxlog):
        kind = bboxlog_kind(entry)
        rect = bboxlog_rect(entry)
        if rect is None:
            continue
        if "text" in kind:
            text_objects.append(_object_box(page, index, "text_object", rect, "bboxlog", flags=(kind,)))
        elif "image" in kind:
            image_objects.append(_object_box(page, index, "image_object", rect, "bboxlog", flags=(kind,)))
        elif "path" in kind or bboxlog_path_blocks_text_strip(kind, rect):
            flags = (kind, "blocks_text_strip") if bboxlog_path_blocks_text_strip(kind, rect) else (kind,)
            path_objects.append(_object_box(page, index, "path_object", rect, "bboxlog", flags=flags))
    return text_objects, image_objects, path_objects


def _text_span_objects(page: fitz.Page) -> list[PdfObjectBox]:
    try:
        text_dict = page.get_text("dict")
    except Exception:
        return []
    spans: list[PdfObjectBox] = []
    span_index = 0
    for block in text_dict.get("blocks", []) or []:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []) or []:
            for span in line.get("spans", []) or []:
                rect = _rect_from_bbox(span.get("bbox"))
                text = str(span.get("text") or "").strip()
                if rect is None or not text:
                    continue
                spans.append(
                    PdfObjectBox(
                        object_id=f"p{page.number + 1:03d}-span-{span_index:04d}",
                        page_index=int(page.number),
                        object_type="text_span",
                        bbox=bbox_from_rect(rect),
                        source="text_dict",
                        text=text,
                    )
                )
                span_index += 1
    return spans


def _form_xobject_objects(page: fitz.Page) -> list[PdfObjectBox]:
    try:
        xobjects = page.get_xobjects()
    except Exception:
        return []
    objects: list[PdfObjectBox] = []
    for index, entry in enumerate(xobjects or []):
        rect = _xobject_rect(entry)
        if rect is None:
            continue
        objects.append(_object_box(page, index, "form_xobject", rect, "xobjects", flags=(_xobject_name(entry),)))
    return objects


def _item_hits(page: fitz.Page, items: list[dict], text_objects: list[PdfObjectBox]) -> list[PdfStructureItemHit]:
    text_rects = tuple(fitz.Rect(obj.bbox) for obj in text_objects)
    if not text_rects:
        return []
    candidate = choose_page_coordinate_candidate(
        page,
        (item.get("bbox", []) for item in items),
        TextRectIndex.build(text_rects),
    )
    hits: list[PdfStructureItemHit] = []
    for item in items:
        item_id = str(item.get("item_id") or "").strip()
        raw_rect = raw_bbox_rect(item.get("bbox", []))
        if not item_id or raw_rect is None:
            continue
        item_rect = candidate.transform(page, raw_rect)
        if item_rect.is_empty:
            continue
        best_object: PdfObjectBox | None = None
        best_ratio = 0.0
        for obj, text_rect in zip(text_objects, text_rects):
            ratio = _overlap_ratio(item_rect, text_rect)
            if ratio > best_ratio:
                best_ratio = ratio
                best_object = obj
        if best_object is not None and best_ratio >= MIN_ITEM_TEXT_OBJECT_OVERLAP_RATIO:
            hits.append(
                PdfStructureItemHit(
                    item_id=item_id,
                    object_id=best_object.object_id,
                    object_type=best_object.object_type,
                    overlap_ratio=round(best_ratio, 4),
                )
            )
    return hits


def _object_box(
    page: fitz.Page,
    index: int,
    object_type: str,
    rect: fitz.Rect,
    source: str,
    *,
    flags: tuple[str, ...] = (),
) -> PdfObjectBox:
    return PdfObjectBox(
        object_id=f"p{page.number + 1:03d}-{object_type}-{index:04d}",
        page_index=int(page.number),
        object_type=object_type,
        bbox=bbox_from_rect(rect),
        source=source,
        flags=tuple(flag for flag in flags if flag),
    )


def _rect_from_bbox(value: object) -> fitz.Rect | None:
    if not isinstance(value, (list, tuple)) or len(value) < 4:
        return None
    try:
        rect = fitz.Rect(float(value[0]), float(value[1]), float(value[2]), float(value[3]))
    except Exception:
        return None
    return None if rect.is_empty else rect


def _xobject_rect(entry: object) -> fitz.Rect | None:
    if isinstance(entry, dict):
        return _rect_from_bbox(entry.get("bbox") or entry.get("rect"))
    if isinstance(entry, (list, tuple)):
        for value in reversed(entry):
            rect = _rect_from_bbox(value)
            if rect is not None:
                return rect
    return None


def _xobject_name(entry: object) -> str:
    if isinstance(entry, dict):
        return str(entry.get("name") or entry.get("xref") or "")
    if isinstance(entry, (list, tuple)) and entry:
        return str(entry[0])
    return ""


def _overlap_ratio(left: fitz.Rect, right: fitz.Rect) -> float:
    left_area = rect_area(left)
    right_area = rect_area(right)
    if left_area <= 0.0 or right_area <= 0.0:
        return 0.0
    overlap = rect_area(left & right)
    return max(overlap / left_area, overlap / right_area)
