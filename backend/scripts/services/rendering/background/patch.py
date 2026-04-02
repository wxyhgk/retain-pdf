from __future__ import annotations

from io import BytesIO

import fitz
from PIL import Image
from PIL import ImageDraw

from services.rendering.redaction.redaction_fill import quantile


STRICT_VERTICAL_MERGE_GAP_PT = 2.0
STRICT_VERTICAL_MERGE_MIN_WIDTH_OVERLAP_RATIO = 0.72


def brightness_spread(pixels: list[tuple[int, int, int]]) -> int:
    if not pixels:
        return 255
    brightness = sorted(int((r + g + b) / 3) for r, g, b in pixels)
    return quantile(brightness, 9, 10) - quantile(brightness, 1, 10)


def map_rect_to_image(image_rect: fitz.Rect, image_size: tuple[int, int], rect: fitz.Rect) -> tuple[int, int, int, int] | None:
    width, height = image_size
    if width <= 0 or height <= 0:
        return None
    inter = rect & image_rect
    if inter.is_empty:
        return None
    sx = width / max(image_rect.width, 1e-6)
    sy = height / max(image_rect.height, 1e-6)
    x0 = max(0, min(width, int((inter.x0 - image_rect.x0) * sx)))
    y0 = max(0, min(height, int((inter.y0 - image_rect.y0) * sy)))
    x1 = max(0, min(width, int((inter.x1 - image_rect.x0) * sx)))
    y1 = max(0, min(height, int((inter.y1 - image_rect.y0) * sy)))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    return x0, y0, x1, y1


def width_overlap_ratio(a: fitz.Rect, b: fitz.Rect) -> float:
    overlap = max(0.0, min(a.x1, b.x1) - max(a.x0, b.x0))
    min_width = max(1e-6, min(a.width, b.width))
    return overlap / min_width


def merge_close_vertical_rects(rects: list[fitz.Rect]) -> list[fitz.Rect]:
    if not rects:
        return []
    ordered = sorted(rects, key=lambda rect: (rect.y0, rect.x0))
    merged: list[fitz.Rect] = [fitz.Rect(ordered[0])]
    for rect in ordered[1:]:
        current = merged[-1]
        gap = rect.y0 - current.y1
        if 0.0 <= gap <= STRICT_VERTICAL_MERGE_GAP_PT and width_overlap_ratio(current, rect) >= STRICT_VERTICAL_MERGE_MIN_WIDTH_OVERLAP_RATIO:
            merged[-1] = fitz.Rect(
                min(current.x0, rect.x0),
                min(current.y0, rect.y0),
                max(current.x1, rect.x1),
                max(current.y1, rect.y1),
            )
            continue
        merged.append(fitz.Rect(rect))
    return merged


def _candidate_strips(width: int, height: int, box: tuple[int, int, int, int]) -> list[tuple[int, int, int, int]]:
    x0, y0, x1, y1 = box
    margin = max(6, min(24, int(min(x1 - x0, y1 - y0) * 0.35)))
    candidates = [
        (max(0, x0 - margin), y0, x0, y1),
        (x1, y0, min(width, x1 + margin), y1),
        (x0, max(0, y0 - margin), x1, y0),
        (x0, y1, x1, min(height, y1 + margin)),
    ]
    return [candidate for candidate in candidates if candidate[2] - candidate[0] >= 2 and candidate[3] - candidate[1] >= 2]


def pick_background_patch(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image | None:
    width, height = image.size
    best_patch: Image.Image | None = None
    best_score: tuple[int, int, int] | None = None
    for candidate in _candidate_strips(width, height, box):
        patch = image.crop(candidate)
        pixels = list(patch.getdata())
        if len(pixels) < 32:
            continue
        spread = brightness_spread(pixels)
        complexity_bucket = 0 if spread <= 18 else 1
        area = (candidate[2] - candidate[0]) * (candidate[3] - candidate[1])
        score = (complexity_bucket, spread, -area)
        if best_score is None or score < best_score:
            best_score = score
            best_patch = patch
    if best_score is None or best_score[0] > 0 or best_patch is None:
        return None
    x0, y0, x1, y1 = box
    return best_patch.resize((x1 - x0, y1 - y0))


def sample_background_color(image: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    width, height = image.size
    x0, y0, x1, y1 = box
    margin = max(8, min(28, int(min(x1 - x0, y1 - y0) * 0.4)))
    outer = (
        max(0, x0 - margin),
        max(0, y0 - margin),
        min(width, x1 + margin),
        min(height, y1 + margin),
    )
    sample = image.crop(outer)
    inner_x0 = x0 - outer[0]
    inner_y0 = y0 - outer[1]
    inner_x1 = x1 - outer[0]
    inner_y1 = y1 - outer[1]
    pixels: list[tuple[int, int, int]] = []
    for yy in range(sample.height):
        inside_y = inner_y0 <= yy < inner_y1
        for xx in range(sample.width):
            if inside_y and inner_x0 <= xx < inner_x1:
                continue
            pixels.append(sample.getpixel((xx, yy)))
    if not pixels:
        return (255, 255, 255)
    rs = sorted(pixel[0] for pixel in pixels)
    gs = sorted(pixel[1] for pixel in pixels)
    bs = sorted(pixel[2] for pixel in pixels)
    return (
        quantile(rs, 1, 2),
        quantile(gs, 1, 2),
        quantile(bs, 1, 2),
    )


def rewrite_background_image(
    image: Image.Image,
    image_rect: fitz.Rect,
    rects: list[fitz.Rect],
) -> Image.Image:
    updated = image.copy()
    for rect in rects:
        mapped = map_rect_to_image(image_rect, updated.size, rect)
        if mapped is None:
            continue
        patch = pick_background_patch(updated, mapped)
        if patch is not None:
            updated.paste(patch, (mapped[0], mapped[1]))
            continue
        updated.paste(sample_background_color(updated, mapped), mapped)
    return updated


def rebuilt_image_bytes(image: Image.Image, payload: dict | None) -> bytes:
    ext = str((payload or {}).get("ext", "") or "").lower()
    buffer = BytesIO()
    if ext in {"jpg", "jpeg"}:
        image.convert("RGB").save(buffer, format="JPEG", quality=85, optimize=True)
        return buffer.getvalue()

    if image.mode not in {"RGB", "RGBA", "L", "LA", "1", "P"}:
        image = image.convert("RGB")
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def rewrite_raw_stream_image(
    image: Image.Image,
    image_rect: fitz.Rect,
    rects: list[fitz.Rect],
    *,
    fill,
) -> Image.Image:
    updated = image.copy()
    draw = ImageDraw.Draw(updated)
    for rect in rects:
        mapped = map_rect_to_image(image_rect, updated.size, rect)
        if mapped is None:
            continue
        x0, y0, x1, y1 = mapped
        draw.rectangle((x0, y0, max(x0, x1 - 1), max(y0, y1 - 1)), fill=fill)
    return updated


__all__ = [
    "map_rect_to_image",
    "merge_close_vertical_rects",
    "rebuilt_image_bytes",
    "rewrite_background_image",
    "rewrite_raw_stream_image",
]
