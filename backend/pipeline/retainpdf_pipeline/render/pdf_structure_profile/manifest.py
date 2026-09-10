from __future__ import annotations

from typing import Any

from retainpdf_pipeline.render.pdf_structure_profile.contracts import PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfObjectBox
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureItemHit
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructurePageProfile
from retainpdf_pipeline.render.pdf_structure_profile.contracts import clamp_bbox


def pdf_structure_profile_to_manifest(profile: PdfStructureDocumentProfile) -> dict[str, Any]:
    return {
        "algorithm": profile.algorithm,
        "pages": {
            str(page_index): _page_to_manifest(page)
            for page_index, page in sorted(profile.pages.items())
        },
    }


def pdf_structure_profile_from_manifest(payload: object) -> PdfStructureDocumentProfile:
    data = dict(payload or {})
    algorithm = str(data.get("algorithm") or "")
    if algorithm != PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION:
        return PdfStructureDocumentProfile(algorithm=algorithm, pages={})
    pages: dict[int, PdfStructurePageProfile] = {}
    for page_key, raw_page in dict(data.get("pages") or {}).items():
        try:
            page_index = int(page_key)
        except (TypeError, ValueError):
            continue
        pages[page_index] = _page_from_manifest(page_index, raw_page)
    return PdfStructureDocumentProfile(algorithm=algorithm, pages=pages)


def _page_to_manifest(page: PdfStructurePageProfile) -> dict[str, Any]:
    return {
        "page_index": page.page_index,
        "page_width_pt": round(float(page.page_width_pt), 3),
        "page_height_pt": round(float(page.page_height_pt), 3),
        "text_objects": [_object_to_manifest(value) for value in page.text_objects],
        "text_spans": [_object_to_manifest(value) for value in page.text_spans],
        "path_objects": [_object_to_manifest(value) for value in page.path_objects],
        "image_objects": [_object_to_manifest(value) for value in page.image_objects],
        "form_xobjects": [_object_to_manifest(value) for value in page.form_xobjects],
        "item_hits": [_hit_to_manifest(value) for value in page.item_hits],
    }


def _object_to_manifest(value: PdfObjectBox) -> dict[str, Any]:
    return {
        "object_id": value.object_id,
        "page_index": value.page_index,
        "object_type": value.object_type,
        "bbox": list(value.bbox),
        "source": value.source,
        "text": value.text,
        "flags": list(value.flags),
    }


def _hit_to_manifest(value: PdfStructureItemHit) -> dict[str, Any]:
    return {
        "item_id": value.item_id,
        "object_id": value.object_id,
        "object_type": value.object_type,
        "overlap_ratio": round(float(value.overlap_ratio), 4),
    }


def _page_from_manifest(page_index: int, payload: object) -> PdfStructurePageProfile:
    data = dict(payload or {})
    return PdfStructurePageProfile(
        page_index=int(data.get("page_index") or page_index),
        page_width_pt=float(data.get("page_width_pt") or 0.0),
        page_height_pt=float(data.get("page_height_pt") or 0.0),
        text_objects=tuple(_object_from_manifest(value) for value in list(data.get("text_objects") or [])),
        text_spans=tuple(_object_from_manifest(value) for value in list(data.get("text_spans") or [])),
        path_objects=tuple(_object_from_manifest(value) for value in list(data.get("path_objects") or [])),
        image_objects=tuple(_object_from_manifest(value) for value in list(data.get("image_objects") or [])),
        form_xobjects=tuple(_object_from_manifest(value) for value in list(data.get("form_xobjects") or [])),
        item_hits=tuple(_hit_from_manifest(value) for value in list(data.get("item_hits") or [])),
    )


def _object_from_manifest(payload: object) -> PdfObjectBox:
    data = dict(payload or {})
    return PdfObjectBox(
        object_id=str(data.get("object_id") or ""),
        page_index=int(data.get("page_index") or 0),
        object_type=str(data.get("object_type") or ""),
        bbox=clamp_bbox(data.get("bbox")),
        source=str(data.get("source") or ""),
        text=str(data.get("text") or ""),
        flags=tuple(str(value) for value in list(data.get("flags") or []) if value),
    )


def _hit_from_manifest(payload: object) -> PdfStructureItemHit:
    data = dict(payload or {})
    return PdfStructureItemHit(
        item_id=str(data.get("item_id") or ""),
        object_id=str(data.get("object_id") or ""),
        object_type=str(data.get("object_type") or ""),
        overlap_ratio=float(data.get("overlap_ratio") or 0.0),
    )
