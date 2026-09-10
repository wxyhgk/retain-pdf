from __future__ import annotations

from dataclasses import dataclass


PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION = "pdf_structure_profile_v1"
BBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class PdfObjectBox:
    object_id: str
    page_index: int
    object_type: str
    bbox: BBox
    source: str
    text: str = ""
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class PdfStructureItemHit:
    item_id: str
    object_id: str
    object_type: str
    overlap_ratio: float


@dataclass(frozen=True)
class PdfStructurePageProfile:
    page_index: int
    page_width_pt: float
    page_height_pt: float
    text_objects: tuple[PdfObjectBox, ...]
    text_spans: tuple[PdfObjectBox, ...]
    path_objects: tuple[PdfObjectBox, ...]
    image_objects: tuple[PdfObjectBox, ...]
    form_xobjects: tuple[PdfObjectBox, ...]
    item_hits: tuple[PdfStructureItemHit, ...]


@dataclass(frozen=True)
class PdfStructureDocumentProfile:
    algorithm: str
    pages: dict[int, PdfStructurePageProfile]


def clamp_bbox(value: object) -> BBox:
    if not isinstance(value, (list, tuple)) or len(value) < 4:
        return (0.0, 0.0, 0.0, 0.0)
    try:
        return tuple(round(float(value[idx]), 3) for idx in range(4))  # type: ignore[return-value]
    except (TypeError, ValueError):
        return (0.0, 0.0, 0.0, 0.0)


def bbox_from_rect(rect) -> BBox:
    return (
        round(float(rect.x0), 3),
        round(float(rect.y0), 3),
        round(float(rect.x1), 3),
        round(float(rect.y1), 3),
    )
