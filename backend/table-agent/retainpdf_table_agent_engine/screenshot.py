"""原表截图：裁到表格的框，长边约 1000 像素，做成发给模型的图片片段（OpenAI Chat 写法的 data URL）。

``page`` 是调用方打开的 PyMuPDF 页（流水线、评测脚本都有）；这里只调它的 ``get_pixmap``，不 import fitz。
Rust 模型执行器一张图解码后最多 4 MB（``model_executor/policy.rs``），PNG 太大就换 JPEG。
"""
from __future__ import annotations

from typing import Any

from retainpdf_translation.llm.shared.model_wire import image_part

SCREENSHOT_LONG_SIDE = 1000
SCREENSHOT_MARGIN_PT = 3.0
# 小表放大到长边 1000 像素时最多放大这么多倍（一个字太大反而看不全）
SCREENSHOT_MAX_ZOOM = 4.0
SCREENSHOT_MAX_BYTES = 3_500_000


def table_screenshot(page: Any, bbox: Any, *, long_side: int = SCREENSHOT_LONG_SIDE) -> tuple[bytes, str]:
    """表格框（PDF point，左上角原点）→ (图片字节, 媒体类型)。框比页面大的部分裁掉。"""
    x0, y0, x1, y1 = (float(value) for value in bbox)
    page_rect = page.rect
    clip = (
        max(float(page_rect.x0), x0 - SCREENSHOT_MARGIN_PT),
        max(float(page_rect.y0), y0 - SCREENSHOT_MARGIN_PT),
        min(float(page_rect.x1), x1 + SCREENSHOT_MARGIN_PT),
        min(float(page_rect.y1), y1 + SCREENSHOT_MARGIN_PT),
    )
    longest = max(clip[2] - clip[0], clip[3] - clip[1], 1.0)
    zoom = min(long_side / longest, SCREENSHOT_MAX_ZOOM)
    pixmap = page.get_pixmap(dpi=max(36, round(72 * zoom)), clip=clip, alpha=False)
    data = pixmap.tobytes("png")
    if len(data) <= SCREENSHOT_MAX_BYTES:
        return data, "image/png"
    return pixmap.tobytes("jpeg"), "image/jpeg"


def table_screenshot_part(page: Any, bbox: Any) -> dict[str, Any]:
    """截图 → 消息里的图片片段（``model_wire.image_part``）。"""
    data, media_type = table_screenshot(page, bbox)
    return image_part(data, media_type)


__all__ = ["SCREENSHOT_LONG_SIDE", "table_screenshot", "table_screenshot_part"]
