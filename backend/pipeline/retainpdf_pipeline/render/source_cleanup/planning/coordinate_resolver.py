from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from typing import Iterable
from typing import Callable

import fitz

from retainpdf_pipeline.render.source.rects import rect_area
from retainpdf_pipeline.render.source_cleanup.planning.spatial_index import RectOverlapIndex
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import bboxlog_path_blocks_text_strip


BBoxTransform = Callable[[fitz.Page, fitz.Rect], fitz.Rect]


@dataclass(frozen=True)
class BBoxCoordinateCandidate:
    name: str
    transform: BBoxTransform


@dataclass(frozen=True)
class BBoxCoordinateScore:
    candidate: BBoxCoordinateCandidate
    rect: fitz.Rect
    text_overlap_count: int
    text_overlap_area: float


@dataclass(frozen=True)
class TextRectIndex:
    rects: tuple[fitz.Rect, ...]
    y0_sorted: tuple[float, ...]

    @classmethod
    def build(cls, rects: Iterable[fitz.Rect]) -> "TextRectIndex":
        ordered = tuple(sorted(rects, key=lambda rect: rect.y0))
        return cls(rects=ordered, y0_sorted=tuple(float(rect.y0) for rect in ordered))

    def score(self, target_rect: fitz.Rect) -> tuple[int, float]:
        if target_rect.is_empty or not self.rects:
            return 0, 0.0
        count = 0
        area = 0.0
        limit = bisect_right(self.y0_sorted, float(target_rect.y1))
        for index in range(limit):
            text_rect = self.rects[index]
            if text_rect.y1 < target_rect.y0:
                continue
            overlap = rect_area(text_rect & target_rect)
            if overlap <= 0.0:
                continue
            count += 1
            area += overlap
        return count, area

    def overlaps_any(self, target_rects: Iterable[fitz.Rect]) -> bool:
        return any(self.score(target_rect)[0] > 0 for target_rect in target_rects)


@dataclass(frozen=True)
class PageBBoxResolver:
    page: fitz.Page
    text_rects: tuple[fitz.Rect, ...]
    text_index: TextRectIndex
    image_rects: tuple[fitz.Rect, ...]
    unsafe_vector_rects: tuple[fitz.Rect, ...]
    unsafe_vector_index: RectOverlapIndex
    preferred_candidate: BBoxCoordinateCandidate

    @classmethod
    def build(cls, page: fitz.Page, bboxes: Iterable[object] = ()) -> "PageBBoxResolver":
        text_rects, image_rects, unsafe_vector_rects = page_bboxlog_rect_groups(page)
        text_index = TextRectIndex.build(text_rects)
        return cls(
            page=page,
            text_rects=text_rects,
            text_index=text_index,
            image_rects=image_rects,
            unsafe_vector_rects=unsafe_vector_rects,
            unsafe_vector_index=RectOverlapIndex.build(unsafe_vector_rects),
            preferred_candidate=choose_page_coordinate_candidate(page, bboxes, text_index),
        )

    def resolve_bbox_rect(self, bbox: object) -> fitz.Rect | None:
        raw_rect = raw_bbox_rect(bbox)
        if raw_rect is None:
            return None
        rect = self.preferred_candidate.transform(self.page, raw_rect)
        return None if rect.is_empty else rect

    def resolve_bbox_probe_rects(self, bbox: object) -> tuple[fitz.Rect, ...]:
        raw_rect = raw_bbox_rect(bbox)
        if raw_rect is None:
            return ()
        rects: dict[tuple[int, int, int, int], fitz.Rect] = {}
        for candidate in BBOX_COORDINATE_CANDIDATES:
            rect = candidate.transform(self.page, raw_rect)
            if not rect.is_empty:
                rects.setdefault(_rect_probe_key(rect), rect)
        return tuple(rects.values())

    def ocr_bbox_to_pdf_rect(self, bbox: object) -> fitz.Rect | None:
        raw_rect = raw_bbox_rect(bbox)
        if raw_rect is None:
            return None
        pdf_rect = raw_rect * ~self.page.transformation_matrix
        return None if pdf_rect.is_empty else pdf_rect

    def has_large_background_image(self, *, coverage_ratio_threshold: float = 0.75) -> bool:
        if not self.image_rects:
            return False
        page_area = max(rect_area(self.page.rect), 1.0)
        if any(rect_area(rect & self.page.rect) / page_area >= coverage_ratio_threshold for rect in self.image_rects):
            return True
        return page_has_tiled_background_images_from_rects(self.page, self.image_rects)


BBOX_COORDINATE_CANDIDATES: tuple[BBoxCoordinateCandidate, ...] = (
    BBoxCoordinateCandidate(
        name="pdf_matrix",
        transform=lambda page, rect: rect * ~page.transformation_matrix,
    ),
    BBoxCoordinateCandidate(
        name="raw_top_left",
        transform=lambda _page, rect: fitz.Rect(rect),
    ),
)


def choose_page_coordinate_candidate(
    page: fitz.Page,
    bboxes: Iterable[object],
    text_index: TextRectIndex,
) -> BBoxCoordinateCandidate:
    raw_rects = tuple(rect for bbox in bboxes if (rect := raw_bbox_rect(bbox)) is not None)
    if not raw_rects:
        return BBOX_COORDINATE_CANDIDATES[0]
    scores = [
        aggregate_candidate_score(page, candidate, raw_rects, text_index)
        for candidate in BBOX_COORDINATE_CANDIDATES
    ]
    return max(scores, key=lambda score: (score.text_overlap_count, score.text_overlap_area)).candidate


def aggregate_candidate_score(
    page: fitz.Page,
    candidate: BBoxCoordinateCandidate,
    raw_rects: tuple[fitz.Rect, ...],
    text_index: TextRectIndex,
) -> BBoxCoordinateScore:
    count = 0
    area = 0.0
    union_rect = fitz.Rect()
    for raw_rect in raw_rects:
        rect = candidate.transform(page, raw_rect)
        if union_rect.is_empty:
            union_rect = fitz.Rect(rect)
        else:
            union_rect.include_rect(rect)
        rect_count, rect_area_sum = text_index.score(rect)
        count += rect_count
        area += rect_area_sum
    return BBoxCoordinateScore(
        candidate=candidate,
        rect=union_rect,
        text_overlap_count=count,
        text_overlap_area=area,
    )


def resolve_bbox_rect(page: fitz.Page, bbox: object) -> fitz.Rect | None:
    raw_rect = raw_bbox_rect(bbox)
    if raw_rect is None:
        return None
    scores = tuple(score_bbox_candidate(page, candidate, raw_rect) for candidate in BBOX_COORDINATE_CANDIDATES)
    best = max(scores, key=lambda score: (score.text_overlap_count, score.text_overlap_area))
    return None if best.rect.is_empty else best.rect


def raw_bbox_rect(bbox: object) -> fitz.Rect | None:
    if not isinstance(bbox, list) or len(bbox) != 4:
        return None
    rect = fitz.Rect(*(to_float(value) for value in bbox))
    return None if rect.is_empty else rect


def _rect_probe_key(rect: fitz.Rect) -> tuple[int, int, int, int]:
    return (
        int(round(rect.x0 * 10)),
        int(round(rect.y0 * 10)),
        int(round(rect.x1 * 10)),
        int(round(rect.y1 * 10)),
    )


def score_bbox_candidate(
    page: fitz.Page,
    candidate: BBoxCoordinateCandidate,
    raw_rect: fitz.Rect,
) -> BBoxCoordinateScore:
    rect = candidate.transform(page, raw_rect)
    count, area = text_overlap_score(page, rect)
    return BBoxCoordinateScore(
        candidate=candidate,
        rect=rect,
        text_overlap_count=count,
        text_overlap_area=area,
    )


def score_bbox_candidate_with_text_rects(
    page: fitz.Page,
    candidate: BBoxCoordinateCandidate,
    raw_rect: fitz.Rect,
    text_rects: tuple[fitz.Rect, ...],
) -> BBoxCoordinateScore:
    rect = candidate.transform(page, raw_rect)
    count, area = TextRectIndex.build(text_rects).score(rect)
    return BBoxCoordinateScore(
        candidate=candidate,
        rect=rect,
        text_overlap_count=count,
        text_overlap_area=area,
    )


def text_overlap_score(page: fitz.Page, target_rect: fitz.Rect) -> tuple[int, float]:
    return text_overlap_score_from_rects(target_rect, page_text_rects(page))


def text_overlap_score_from_rects(target_rect: fitz.Rect, text_rects: tuple[fitz.Rect, ...]) -> tuple[int, float]:
    return TextRectIndex.build(text_rects).score(target_rect)


def page_text_rects(page: fitz.Page) -> tuple[fitz.Rect, ...]:
    return page_bboxlog_rect_groups(page)[0]


def page_bboxlog_rect_groups(page: fitz.Page) -> tuple[tuple[fitz.Rect, ...], tuple[fitz.Rect, ...], tuple[fitz.Rect, ...]]:
    try:
        bboxlog = page.get_bboxlog()
    except Exception:
        return (), (), ()
    rects: list[fitz.Rect] = []
    image_rects: list[fitz.Rect] = []
    unsafe_vector_rects: list[fitz.Rect] = []
    for entry in bboxlog:
        kind = bboxlog_kind(entry)
        rect = bboxlog_rect(entry)
        if rect is None:
            continue
        if "text" in kind:
            rects.append(rect)
            continue
        if "image" in kind:
            image_rects.append(rect)
            continue
        if bboxlog_path_blocks_text_strip(kind, rect):
            unsafe_vector_rects.append(rect)
    return tuple(rects), tuple(image_rects), tuple(unsafe_vector_rects)


def bboxlog_text_rect(entry: object) -> fitz.Rect | None:
    if "text" not in bboxlog_kind(entry):
        return None
    return bboxlog_rect(entry)


def bboxlog_kind(entry: object) -> str:
    try:
        return str(entry[0]).strip().lower()
    except Exception:
        return ""


def bboxlog_rect(entry: object) -> fitz.Rect | None:
    try:
        value = entry[1]
    except Exception:
        return None
    try:
        rect = fitz.Rect(value)
    except Exception:
        return None
    return None if rect.is_empty else rect


def page_has_tiled_background_images_from_rects(
    page: fitz.Page,
    image_rects: tuple[fitz.Rect, ...],
    *,
    coverage_ratio_threshold: float = 0.65,
    min_image_count: int = 8,
    min_width_ratio: float = 0.60,
) -> bool:
    if len(image_rects) < min_image_count:
        return False
    page_area = max(rect_area(page.rect), 1.0)
    page_width = max(float(page.rect.width), 1.0)
    page_wide_rects = [
        rect & page.rect
        for rect in image_rects
        if not (rect & page.rect).is_empty and (rect & page.rect).width / page_width >= min_width_ratio
    ]
    if len(page_wide_rects) < min_image_count:
        return False
    covered_area = sum(rect_area(rect & page.rect) for rect in _merge_vertical_image_bands(page_wide_rects))
    return covered_area / page_area >= coverage_ratio_threshold


def _merge_vertical_image_bands(rects: list[fitz.Rect], *, y_tolerance: float = 1.0) -> list[fitz.Rect]:
    merged: list[fitz.Rect] = []
    for rect in sorted(rects, key=lambda value: (round(value.y0, 3), round(value.x0, 3))):
        if not merged:
            merged.append(fitz.Rect(rect))
            continue
        previous = merged[-1]
        if rect.y0 <= previous.y1 + y_tolerance:
            previous.include_rect(rect)
        else:
            merged.append(fitz.Rect(rect))
    return merged


def to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default
