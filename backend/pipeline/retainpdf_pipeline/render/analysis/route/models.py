from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


PageRedactionRoute = Literal[
    "text_layer_only",
    "visual_cover",
    "visual_cover_and_remove_text",
]

PageBackgroundRoute = Literal[
    "source_pdf_page",
    "image_background",
    "hidden_text_stripped_source",
    "cleaned_background",
]

PageComposeRoute = Literal[
    "typst_overlay",
    "typst_background",
]

PageLayoutRoute = Literal[
    "ocr_bbox_overlay",
]

RenderModeHint = Literal[
    "overlay",
    "typst_visual",
]

TextCleanupRoute = Literal[
    "pikepdf_text_strip",
    "hidden_text_strip",
    "visual_cover",
    "visual_cover_and_remove_text",
    "skip",
]

OverlayFallbackRoute = Literal[
    "none",
    "page_visual_cover",
    "item_visual_cover",
]


@dataclass(frozen=True)
class RenderPageRoute:
    redaction: PageRedactionRoute
    background: PageBackgroundRoute
    compose: PageComposeRoute
    layout: PageLayoutRoute
    reason: str

    @property
    def render_mode_hint(self) -> RenderModeHint:
        return "overlay" if self.compose == "typst_overlay" else "typst_visual"

    @property
    def text_cleanup(self) -> TextCleanupRoute:
        if self.redaction == "text_layer_only":
            return "pikepdf_text_strip"
        if self.redaction == "visual_cover_and_remove_text":
            return "visual_cover_and_remove_text"
        if self.redaction == "visual_cover":
            return "visual_cover"
        return "skip"

    @property
    def overlay_fallback(self) -> OverlayFallbackRoute:
        return "none" if self.redaction == "text_layer_only" else "page_visual_cover"
