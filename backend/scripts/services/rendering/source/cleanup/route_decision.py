from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from services.rendering.source.cleanup.strategy import RedactionRoute


ResolvedRedactionExecution = Literal[
    "auto",
    "visual_cover",
    "visual_cover_and_remove_text",
    "image_page_redaction",
    "cover_only_count",
    "vector_heavy_redaction",
    "standard_redaction",
]


@dataclass(frozen=True)
class RedactionRouteDecision:
    execution: ResolvedRedactionExecution
    route: RedactionRoute
    image_page: bool
    drawing_count: int
