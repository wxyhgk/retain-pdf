from __future__ import annotations

from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.source.background.config import BACKGROUND_COVER_COMPLEXITY_BRIGHTNESS_SPREAD
from retainpdf_pipeline.render.source.background.config import BACKGROUND_COVER_MIN_SAMPLE_PIXELS
from retainpdf_pipeline.render.source.background.config import BACKGROUND_COVER_SAMPLE_MARGIN_PT
from retainpdf_pipeline.render.source.background.config import BACKGROUND_COVER_SAMPLE_SCALE
from retainpdf_pipeline.render.source.background.config import BACKGROUND_CLIP_SAMPLER_EXTRA_MARGIN_PT
from retainpdf_pipeline.render.source.background.config import BACKGROUND_FULL_PAGE_SAMPLER_MIN_RECTS
from retainpdf_pipeline.render.source.background.config import BACKGROUND_CLIP_SAMPLER_MAX_PAGE_AREA_RATIO
from retainpdf_pipeline.render.source.background.config import BACKGROUND_CLIP_SAMPLER_MIN_RECTS
from retainpdf_pipeline.render.source.background.config import BACKGROUND_COVER_MAX_SAMPLE_PIXELS
from retainpdf_pipeline.render.source.background.config import BACKGROUND_FILL_DOMINANT_BIN_SIZE
from retainpdf_pipeline.render.source.background.config import BACKGROUND_FILL_DOMINANT_MIN_RATIO
from retainpdf_pipeline.render.source.background.config import BACKGROUND_FILL_NONWHITE_MAX_CHANNEL
from retainpdf_pipeline.render.source.background.config import BACKGROUND_PATCH_LIGHT_BG_MEDIAN_MIN
from retainpdf_pipeline.render.source.background.config import BACKGROUND_PATCH_LIGHT_BG_P90_MIN
from retainpdf_pipeline.render.source.background.config import BACKGROUND_PATCH_TEXT_CONTAMINATION_DARK_RATIO
from retainpdf_pipeline.render.source.background.config import BACKGROUND_PATCH_TEXT_CONTAMINATION_DARK_VALUE
from retainpdf_pipeline.render.source.background.sampling import quantile
from retainpdf_pipeline.render.source.rects import rect_area


@dataclass
class PreparedBackgroundCover:
    rect: fitz.Rect
    pixmap: fitz.Pixmap | None = None
    fill: tuple[float, float, float] | None = None


class LocalBackgroundSampler:
    def __init__(self, page_rect: fitz.Rect, clip_rect: fitz.Rect, pixmap: fitz.Pixmap) -> None:
        self.page_rect = fitz.Rect(page_rect)
        self.clip_rect = fitz.Rect(clip_rect)
        self.pixmap = pixmap
        self.samples = memoryview(pixmap.samples)
        self.stride = pixmap.n

    @classmethod
    def build(cls, page: fitz.Page, rects: list[fitz.Rect]) -> "LocalBackgroundSampler | None":
        clip_rect = _batch_sampler_clip_rect(page, rects, allow_full_page=True)
        if clip_rect is None:
            return None
        pixmap = _clip_pixmap(page, clip_rect)
        if pixmap is None or pixmap.width <= 0 or pixmap.height <= 0 or pixmap.n < 3:
            return None
        return cls(fitz.Rect(page.rect), clip_rect, pixmap)

    def sample_local_background_fill(self, rect: fitz.Rect) -> tuple[float, float, float] | None:
        if not self._can_sample(rect):
            return None
        inner_fill = _dominant_nonwhite_fill_from_pixels(self._pixels_in_rect(rect))
        if inner_fill is not None:
            return inner_fill

        outer = _background_sample_outer_rect_from_page_rect(self.page_rect, rect)
        if outer is None:
            return self._sample_clean_neighbor_fill(rect) or (1, 1, 1)

        pixels = self._pixels_in_rect_excluding(outer, rect)
        robust_fill = _robust_fill_from_pixels(pixels)
        if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
            return robust_fill or self._sample_clean_neighbor_fill(rect) or (1, 1, 1)

        spread = _brightness_spread(pixels)
        if spread > BACKGROUND_COVER_COMPLEXITY_BRIGHTNESS_SPREAD:
            return robust_fill or self._sample_clean_neighbor_fill(rect) or (1, 1, 1)

        rs = sorted(r for r, _g, _b in pixels)
        gs = sorted(g for _r, g, _b in pixels)
        bs = sorted(b for _r, _g, b in pixels)
        return (
            quantile(rs, 1, 2) / 255.0,
            quantile(gs, 1, 2) / 255.0,
            quantile(bs, 1, 2) / 255.0,
        )

    def _can_sample(self, rect: fitz.Rect) -> bool:
        outer = _background_sample_outer_rect_from_page_rect(self.page_rect, rect)
        target = outer or rect
        return _rect_contains(self.clip_rect, target)

    def _sample_clean_neighbor_fill(self, rect: fitz.Rect) -> tuple[float, float, float] | None:
        best_fill: tuple[float, float, float] | None = None
        best_score: tuple[int, int, float] | None = None
        for candidate in _patch_candidate_rects(self.page_rect, rect):
            if not _rect_contains(self.clip_rect, candidate):
                continue
            pixels = self._pixels_in_rect(candidate)
            if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
                continue
            if _looks_like_text_contaminated_light_patch(pixels):
                continue
            fill = _robust_fill_from_pixels(pixels)
            if fill is None:
                continue
            spread = _brightness_spread(pixels)
            complexity_bucket = 0 if spread <= BACKGROUND_COVER_COMPLEXITY_BRIGHTNESS_SPREAD else 1
            score = (complexity_bucket, spread, -rect_area(candidate))
            if best_score is None or score < best_score:
                best_score = score
                best_fill = fill
        if best_score is not None and best_score[0] <= 0:
            return best_fill
        return None

    def _pixels_in_rect(self, rect: fitz.Rect) -> list[tuple[int, int, int]]:
        bounds = self._pixel_bounds(rect)
        if bounds is None:
            return []
        x0, y0, x1, y1 = bounds
        return self._pixels_in_bounds(x0, y0, x1, y1)

    def _pixels_in_rect_excluding(self, rect: fitz.Rect, excluded: fitz.Rect) -> list[tuple[int, int, int]]:
        bounds = self._pixel_bounds(rect)
        if bounds is None:
            return []
        excluded_bounds = self._pixel_bounds(excluded)
        if excluded_bounds is None:
            x0, y0, x1, y1 = bounds
            return self._pixels_in_bounds(x0, y0, x1, y1)
        x0, y0, x1, y1 = bounds
        ex0, ey0, ex1, ey1 = excluded_bounds
        pixels: list[tuple[int, int, int]] = []
        step = _sample_step_for_bounds(x0, y0, x1, y1)
        for y in range(y0, y1, step):
            inside_y = ey0 <= y < ey1
            row_offset = y * self.pixmap.width * self.stride
            for x in range(x0, x1, step):
                if inside_y and ex0 <= x < ex1:
                    continue
                offset = row_offset + x * self.stride
                pixels.append((self.samples[offset], self.samples[offset + 1], self.samples[offset + 2]))
        return pixels

    def _pixels_in_bounds(self, x0: int, y0: int, x1: int, y1: int) -> list[tuple[int, int, int]]:
        pixels: list[tuple[int, int, int]] = []
        step = _sample_step_for_bounds(x0, y0, x1, y1)
        for y in range(y0, y1, step):
            row_offset = y * self.pixmap.width * self.stride
            for x in range(x0, x1, step):
                offset = row_offset + x * self.stride
                pixels.append((self.samples[offset], self.samples[offset + 1], self.samples[offset + 2]))
        return pixels

    def _pixel_bounds(self, rect: fitz.Rect) -> tuple[int, int, int, int] | None:
        clipped = fitz.Rect(rect) & self.clip_rect
        if clipped.is_empty or clipped.width <= 0 or clipped.height <= 0:
            return None
        x0 = _coord_to_pixel(clipped.x0, self.clip_rect.x0, self.clip_rect.width, self.pixmap.width, ceil=False)
        y0 = _coord_to_pixel(clipped.y0, self.clip_rect.y0, self.clip_rect.height, self.pixmap.height, ceil=False)
        x1 = _coord_to_pixel(clipped.x1, self.clip_rect.x0, self.clip_rect.width, self.pixmap.width, ceil=True)
        y1 = _coord_to_pixel(clipped.y1, self.clip_rect.y0, self.clip_rect.height, self.pixmap.height, ceil=True)
        if x1 <= x0 or y1 <= y0:
            return None
        return x0, y0, x1, y1


def _background_sample_outer_rect(page: fitz.Page, rect: fitz.Rect) -> fitz.Rect | None:
    return _background_sample_outer_rect_from_page_rect(fitz.Rect(page.rect), rect)


def _background_sample_outer_rect_from_page_rect(page_rect: fitz.Rect, rect: fitz.Rect) -> fitz.Rect | None:
    outer = (
        fitz.Rect(
            rect.x0 - BACKGROUND_COVER_SAMPLE_MARGIN_PT,
            rect.y0 - BACKGROUND_COVER_SAMPLE_MARGIN_PT,
            rect.x1 + BACKGROUND_COVER_SAMPLE_MARGIN_PT,
            rect.y1 + BACKGROUND_COVER_SAMPLE_MARGIN_PT,
        )
        & page_rect
    )
    if outer.is_empty or outer.width <= 1 or outer.height <= 1:
        return None
    return outer


def _batch_sampler_clip_rect(
    page: fitz.Page,
    rects: list[fitz.Rect],
    *,
    allow_full_page: bool = False,
) -> fitz.Rect | None:
    valid_rects = [fitz.Rect(rect) for rect in rects if not rect.is_empty and not rect.is_infinite]
    if len(valid_rects) < BACKGROUND_CLIP_SAMPLER_MIN_RECTS:
        return None
    page_rect = fitz.Rect(page.rect)
    clip: fitz.Rect | None = None
    for rect in valid_rects:
        outer = _background_sample_outer_rect_from_page_rect(page_rect, rect) or rect
        expanded = fitz.Rect(
            outer.x0 - BACKGROUND_CLIP_SAMPLER_EXTRA_MARGIN_PT,
            outer.y0 - BACKGROUND_CLIP_SAMPLER_EXTRA_MARGIN_PT,
            outer.x1 + BACKGROUND_CLIP_SAMPLER_EXTRA_MARGIN_PT,
            outer.y1 + BACKGROUND_CLIP_SAMPLER_EXTRA_MARGIN_PT,
        ) & page_rect
        clip = expanded if clip is None else clip | expanded
    if clip is None or clip.is_empty:
        return None
    if rect_area(clip) / max(rect_area(page_rect), 1.0) > BACKGROUND_CLIP_SAMPLER_MAX_PAGE_AREA_RATIO:
        if allow_full_page and len(valid_rects) >= BACKGROUND_FULL_PAGE_SAMPLER_MIN_RECTS:
            return page_rect
        return None
    return clip


def _coord_to_pixel(value: float, origin: float, span: float, pixels: int, *, ceil: bool) -> int:
    raw = (value - origin) / max(span, 1e-6) * pixels
    if ceil:
        return max(0, min(pixels, int(raw + 0.999)))
    return max(0, min(pixels, int(raw)))


def _rect_contains(container: fitz.Rect, rect: fitz.Rect) -> bool:
    clipped = fitz.Rect(rect) & container
    return not clipped.is_empty and abs(rect_area(clipped) - rect_area(fitz.Rect(rect))) <= 0.01


def _clip_pixmap(page: fitz.Page, clip: fitz.Rect) -> fitz.Pixmap | None:
    try:
        return page.get_pixmap(
            clip=clip,
            matrix=fitz.Matrix(BACKGROUND_COVER_SAMPLE_SCALE, BACKGROUND_COVER_SAMPLE_SCALE),
            colorspace=fitz.csRGB,
            alpha=False,
        )
    except Exception:
        return None


def _pixmap_rgb_pixels(pix: fitz.Pixmap) -> list[tuple[int, int, int]]:
    if pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        return []
    samples = memoryview(pix.samples)
    stride = pix.n
    pixels: list[tuple[int, int, int]] = []
    step = _sample_step_for_bounds(0, 0, pix.width, pix.height)
    for y in range(0, pix.height, step):
        row_offset = y * pix.width * stride
        for x in range(0, pix.width, step):
            offset = row_offset + x * stride
            pixels.append((samples[offset], samples[offset + 1], samples[offset + 2]))
    return pixels


def _sample_step_for_bounds(x0: int, y0: int, x1: int, y1: int) -> int:
    width = max(0, x1 - x0)
    height = max(0, y1 - y0)
    total = width * height
    if total <= BACKGROUND_COVER_MAX_SAMPLE_PIXELS:
        return 1
    return max(1, int((total / BACKGROUND_COVER_MAX_SAMPLE_PIXELS) ** 0.5))


def _brightness_spread(pixels: list[tuple[int, int, int]]) -> int:
    if not pixels:
        return 255
    brightness = sorted(int((r + g + b) / 3) for r, g, b in pixels)
    return quantile(brightness, 9, 10) - quantile(brightness, 1, 10)


def _looks_like_text_contaminated_light_patch(pixels: list[tuple[int, int, int]]) -> bool:
    if not pixels:
        return False
    brightness = sorted(int((r + g + b) / 3) for r, g, b in pixels)
    median = quantile(brightness, 1, 2)
    p90 = quantile(brightness, 9, 10)
    if median < BACKGROUND_PATCH_LIGHT_BG_MEDIAN_MIN or p90 < BACKGROUND_PATCH_LIGHT_BG_P90_MIN:
        return False
    dark_pixels = sum(1 for value in brightness if value < BACKGROUND_PATCH_TEXT_CONTAMINATION_DARK_VALUE)
    dark_ratio = dark_pixels / max(len(brightness), 1)
    return dark_ratio >= BACKGROUND_PATCH_TEXT_CONTAMINATION_DARK_RATIO


def _robust_fill_from_pixels(pixels: list[tuple[int, int, int]]) -> tuple[float, float, float] | None:
    if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
        return None
    brightness_pixels = sorted(
        ((int((r + g + b) / 3), r, g, b) for r, g, b in pixels),
        key=lambda item: item[0],
    )
    keep_from = min(len(brightness_pixels) - 1, max(0, len(brightness_pixels) // 5))
    trimmed = brightness_pixels[keep_from:]
    if not trimmed:
        return None
    rs = sorted(item[1] for item in trimmed)
    gs = sorted(item[2] for item in trimmed)
    bs = sorted(item[3] for item in trimmed)
    return (
        quantile(rs, 1, 2) / 255.0,
        quantile(gs, 1, 2) / 255.0,
        quantile(bs, 1, 2) / 255.0,
    )


def _dominant_nonwhite_fill_from_pixels(pixels: list[tuple[int, int, int]]) -> tuple[float, float, float] | None:
    if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
        return None
    bin_size = max(1, BACKGROUND_FILL_DOMINANT_BIN_SIZE)
    bins: dict[tuple[int, int, int], list[tuple[int, int, int]]] = {}
    for r, g, b in pixels:
        key = (r // bin_size, g // bin_size, b // bin_size)
        bins.setdefault(key, []).append((r, g, b))
    if not bins:
        return None
    dominant = max(bins.values(), key=len)
    if len(dominant) / max(len(pixels), 1) < BACKGROUND_FILL_DOMINANT_MIN_RATIO:
        return None
    rs = sorted(pixel[0] for pixel in dominant)
    gs = sorted(pixel[1] for pixel in dominant)
    bs = sorted(pixel[2] for pixel in dominant)
    fill = (
        quantile(rs, 1, 2) / 255.0,
        quantile(gs, 1, 2) / 255.0,
        quantile(bs, 1, 2) / 255.0,
    )
    if max(fill) >= BACKGROUND_FILL_NONWHITE_MAX_CHANNEL:
        return None
    return fill


def _sample_clean_neighbor_fill(page: fitz.Page, rect: fitz.Rect) -> tuple[float, float, float] | None:
    best_fill: tuple[float, float, float] | None = None
    best_score: tuple[int, int, float] | None = None
    for candidate in _patch_candidate_rects(fitz.Rect(page.rect), rect):
        pix = _clip_pixmap(page, candidate)
        if pix is None:
            continue
        pixels = _pixmap_rgb_pixels(pix)
        if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
            continue
        if _looks_like_text_contaminated_light_patch(pixels):
            continue
        fill = _robust_fill_from_pixels(pixels)
        if fill is None:
            continue
        spread = _brightness_spread(pixels)
        complexity_bucket = 0 if spread <= BACKGROUND_COVER_COMPLEXITY_BRIGHTNESS_SPREAD else 1
        score = (complexity_bucket, spread, -rect_area(candidate))
        if best_score is None or score < best_score:
            best_score = score
            best_fill = fill
    if best_score is not None and best_score[0] <= 0:
        return best_fill
    return None


def sample_local_background_fill(
    page: fitz.Page,
    rect: fitz.Rect,
    *,
    sampler: LocalBackgroundSampler | None = None,
) -> tuple[float, float, float]:
    if sampler is not None:
        sampled = sampler.sample_local_background_fill(rect)
        if sampled is not None:
            return sampled
    inner_pix = _clip_pixmap(page, rect)
    if inner_pix is not None:
        inner_fill = _dominant_nonwhite_fill_from_pixels(_pixmap_rgb_pixels(inner_pix))
        if inner_fill is not None:
            return inner_fill

    outer = _background_sample_outer_rect(page, rect)
    if outer is None:
        clean_neighbor_fill = _sample_clean_neighbor_fill(page, rect)
        return clean_neighbor_fill or (1, 1, 1)

    pix = _clip_pixmap(page, outer)
    if pix is None or pix.width <= 0 or pix.height <= 0 or pix.n < 3:
        clean_neighbor_fill = _sample_clean_neighbor_fill(page, rect)
        return clean_neighbor_fill or (1, 1, 1)

    inner_x0 = (rect.x0 - outer.x0) / max(outer.width, 1e-6) * pix.width
    inner_y0 = (rect.y0 - outer.y0) / max(outer.height, 1e-6) * pix.height
    inner_x1 = (rect.x1 - outer.x0) / max(outer.width, 1e-6) * pix.width
    inner_y1 = (rect.y1 - outer.y0) / max(outer.height, 1e-6) * pix.height

    samples = memoryview(pix.samples)
    stride = pix.n
    pixels: list[tuple[int, int, int]] = []
    for y in range(pix.height):
        inside_y = inner_y0 <= y < inner_y1
        row_offset = y * pix.width * stride
        for x in range(pix.width):
            if inside_y and inner_x0 <= x < inner_x1:
                continue
            offset = row_offset + x * stride
            pixels.append((samples[offset], samples[offset + 1], samples[offset + 2]))

    robust_fill = _robust_fill_from_pixels(pixels)
    if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
        clean_neighbor_fill = _sample_clean_neighbor_fill(page, rect)
        return robust_fill or clean_neighbor_fill or (1, 1, 1)

    spread = _brightness_spread(pixels)
    if spread > BACKGROUND_COVER_COMPLEXITY_BRIGHTNESS_SPREAD:
        clean_neighbor_fill = _sample_clean_neighbor_fill(page, rect)
        return robust_fill or clean_neighbor_fill or (1, 1, 1)

    rs = sorted(r for r, _g, _b in pixels)
    gs = sorted(g for _r, g, _b in pixels)
    bs = sorted(b for _r, _g, b in pixels)
    return (
        quantile(rs, 1, 2) / 255.0,
        quantile(gs, 1, 2) / 255.0,
        quantile(bs, 1, 2) / 255.0,
    )


def resolved_fill_color(
    page: fitz.Page,
    rect: fitz.Rect,
    fill: tuple[float, float, float] | None,
) -> tuple[float, float, float] | None:
    if fill is None:
        return None
    if fill != (1, 1, 1):
        return fill
    return sample_local_background_fill(page, rect)


def _patch_candidate_rects(page_rect: fitz.Rect, rect: fitz.Rect) -> list[fitz.Rect]:
    margin = max(BACKGROUND_COVER_SAMPLE_MARGIN_PT, min(18.0, max(4.0, min(rect.width, rect.height) * 0.35)))
    candidates = [
        fitz.Rect(rect.x0 - margin, rect.y0, rect.x0, rect.y1),
        fitz.Rect(rect.x1, rect.y0, rect.x1 + margin, rect.y1),
        fitz.Rect(rect.x0, rect.y0 - margin, rect.x1, rect.y0),
        fitz.Rect(rect.x0, rect.y1, rect.x1, rect.y1 + margin),
    ]
    valid: list[fitz.Rect] = []
    for candidate in candidates:
        clipped = candidate & page_rect
        if clipped.is_empty or clipped.width <= 1 or clipped.height <= 1:
            continue
        valid.append(clipped)
    return valid


def cover_rect_with_background_patch(page: fitz.Page, rect: fitz.Rect) -> bool:
    prepared = prepare_background_cover(page, rect)
    if prepared is None:
        return False
    apply_prepared_background_cover(page, prepared)
    return True


def prepare_background_cover(page: fitz.Page, rect: fitz.Rect) -> PreparedBackgroundCover | None:
    page_rect = fitz.Rect(page.rect)
    best_pixmap: fitz.Pixmap | None = None
    best_score: tuple[int, int, float] | None = None
    for candidate in _patch_candidate_rects(page_rect, rect):
        pix = _clip_pixmap(page, candidate)
        if pix is None:
            continue
        pixels = _pixmap_rgb_pixels(pix)
        if len(pixels) < BACKGROUND_COVER_MIN_SAMPLE_PIXELS:
            continue
        if _looks_like_text_contaminated_light_patch(pixels):
            continue
        spread = _brightness_spread(pixels)
        complexity_bucket = 0 if spread <= BACKGROUND_COVER_COMPLEXITY_BRIGHTNESS_SPREAD else 1
        score = (complexity_bucket, spread, -rect_area(candidate))
        if best_score is None or score < best_score:
            best_score = score
            best_pixmap = pix

    if best_pixmap is not None and best_score is not None and best_score[0] <= 0:
        return PreparedBackgroundCover(rect=fitz.Rect(rect), pixmap=best_pixmap)

    return PreparedBackgroundCover(
        rect=fitz.Rect(rect),
        fill=sample_local_background_fill(page, rect),
    )


def apply_prepared_background_cover(page: fitz.Page, cover: PreparedBackgroundCover) -> None:
    if cover.pixmap is not None:
        try:
            page.insert_image(cover.rect, pixmap=cover.pixmap, keep_proportion=False, overlay=True)
            return
        except Exception:
            pass

    fill = cover.fill or sample_local_background_fill(page, cover.rect)
    shape = page.new_shape()
    shape.draw_rect(cover.rect)
    shape.finish(color=None, fill=fill)
    shape.commit(overlay=True)


def prepare_background_covers(
    page: fitz.Page,
    rects: list[fitz.Rect],
) -> list[PreparedBackgroundCover]:
    covers: list[PreparedBackgroundCover] = []
    for rect in rects:
        prepared = prepare_background_cover(page, rect)
        if prepared is None:
            prepared = PreparedBackgroundCover(
                rect=fitz.Rect(rect),
                fill=sample_local_background_fill(page, rect),
            )
        covers.append(prepared)
    return covers


def apply_prepared_background_covers(
    page: fitz.Page,
    covers: list[PreparedBackgroundCover],
) -> None:
    for cover in covers:
        apply_prepared_background_cover(page, cover)


def draw_white_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        fill = sample_local_background_fill(page, rect)
        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=None, fill=fill)
        shape.commit(overlay=True)


def draw_flat_white_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    draw_white_covers(page, rects)


def draw_background_covers(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        apply_prepared_background_cover(
            page,
            prepare_background_cover(page, rect)
            or PreparedBackgroundCover(rect=fitz.Rect(rect), fill=sample_local_background_fill(page, rect)),
        )
