from __future__ import annotations

import fitz

from services.rendering.background.detect import page_has_large_background_image
from services.rendering.background.detect import pick_primary_background_image
from services.rendering.background.extract import extract_image_payload
from services.rendering.background.extract import extract_image_rgb
from services.rendering.background.extract import extract_raw_stream_image
from services.rendering.background.extract import raw_stream_image_meta
from services.rendering.background.patch import merge_close_vertical_rects
from services.rendering.background.patch import rebuilt_image_bytes
from services.rendering.background.patch import rewrite_background_image
from services.rendering.background.patch import rewrite_raw_stream_image
from services.rendering.redaction.shared import iter_valid_translated_items


def replace_background_image_page(
    page: fitz.Page,
    translated_items: list[dict],
) -> bool:
    if not page_has_large_background_image(page):
        return False
    primary = pick_primary_background_image(page)
    if primary is None:
        return False

    xref, image_rect = primary
    doc = page.parent
    rects: list[fitz.Rect] = []
    for _rect, item, _translated_text in iter_valid_translated_items(translated_items):
        bbox = item.get("bbox", [])
        if len(bbox) != 4:
            continue
        rects.append(fitz.Rect(bbox))
    rects = merge_close_vertical_rects(rects)
    if not rects:
        return False

    raw_meta = raw_stream_image_meta(doc, xref)
    if raw_meta is not None:
        raw_image = extract_raw_stream_image(doc, xref, raw_meta)
        if raw_image is not None:
            rebuilt_raw = rewrite_raw_stream_image(raw_image, image_rect, rects, fill=raw_meta["fill"])
            try:
                doc.update_stream(xref, rebuilt_raw.tobytes(), new=0, compress=1)
                return True
            except Exception:
                pass

    payload = extract_image_payload(doc, xref)
    image = extract_image_rgb(doc, xref)
    if image is None:
        return False

    rebuilt = rewrite_background_image(image, image_rect, rects)
    image_bytes = rebuilt_image_bytes(rebuilt, payload)
    try:
        page.replace_image(xref, stream=image_bytes)
        return True
    except Exception:
        return False


__all__ = ["replace_background_image_page"]
