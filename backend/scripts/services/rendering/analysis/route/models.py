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


@dataclass(frozen=True)
class RenderPageRoute:
    redaction: PageRedactionRoute
    background: PageBackgroundRoute
    compose: PageComposeRoute
    layout: PageLayoutRoute
    reason: str
