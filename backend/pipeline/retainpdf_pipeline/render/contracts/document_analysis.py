from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from retainpdf_pipeline.render.analysis.profile.models import RenderPageKind
from retainpdf_pipeline.render.analysis.route.models import PageBackgroundRoute
from retainpdf_pipeline.render.analysis.route.models import PageComposeRoute
from retainpdf_pipeline.render.analysis.route.models import PageLayoutRoute
from retainpdf_pipeline.render.analysis.route.models import PageRedactionRoute


RENDER_DOCUMENT_PROFILE_ALGORITHM_VERSION = "render_document_profile_v1"


@dataclass(frozen=True)
class RenderPageAnalysis:
    page_index: int
    kind: RenderPageKind
    redaction: PageRedactionRoute
    background: PageBackgroundRoute
    compose: PageComposeRoute
    layout: PageLayoutRoute
    reason: str
    has_large_background: bool
    background_coverage_ratio: float
    visible_text: bool
    hidden_text: bool
    editable_text: bool
    drawing_count: int
    vector_heavy: bool

    @property
    def allows_pikepdf_text_strip(self) -> bool:
        return self.redaction == "text_layer_only" and self.kind == "editable_text"

    @property
    def needs_visual_cover(self) -> bool:
        return self.redaction in {"visual_cover", "visual_cover_and_remove_text"}

    @property
    def needs_hidden_text_strip(self) -> bool:
        return self.redaction == "visual_cover_and_remove_text"

    def to_manifest(self) -> dict[str, Any]:
        return {
            "page_index": self.page_index,
            "kind": self.kind,
            "redaction": self.redaction,
            "background": self.background,
            "compose": self.compose,
            "layout": self.layout,
            "reason": self.reason,
            "has_large_background": self.has_large_background,
            "background_coverage_ratio": round(float(self.background_coverage_ratio), 6),
            "visible_text": self.visible_text,
            "hidden_text": self.hidden_text,
            "editable_text": self.editable_text,
            "drawing_count": self.drawing_count,
            "vector_heavy": self.vector_heavy,
        }

    @classmethod
    def from_manifest(cls, value: object) -> "RenderPageAnalysis | None":
        payload = dict(value or {})
        try:
            return cls(
                page_index=int(payload.get("page_index")),
                kind=str(payload.get("kind") or "editable_text"),
                redaction=str(payload.get("redaction") or "text_layer_only"),
                background=str(payload.get("background") or "source_pdf_page"),
                compose=str(payload.get("compose") or "typst_overlay"),
                layout=str(payload.get("layout") or "ocr_bbox_overlay"),
                reason=str(payload.get("reason") or ""),
                has_large_background=bool(payload.get("has_large_background")),
                background_coverage_ratio=float(payload.get("background_coverage_ratio") or 0.0),
                visible_text=bool(payload.get("visible_text")),
                hidden_text=bool(payload.get("hidden_text")),
                editable_text=bool(payload.get("editable_text")),
                drawing_count=int(payload.get("drawing_count") or 0),
                vector_heavy=bool(payload.get("vector_heavy")),
            )
        except Exception:
            return None


@dataclass(frozen=True)
class RenderDocumentAnalysis:
    pages: dict[int, RenderPageAnalysis]
    algorithm: str = RENDER_DOCUMENT_PROFILE_ALGORITHM_VERSION

    def page(self, page_index: int) -> RenderPageAnalysis | None:
        return self.pages.get(int(page_index))

    @property
    def pikepdf_text_strip_page_indices(self) -> frozenset[int]:
        return frozenset(page_idx for page_idx, page in self.pages.items() if page.allows_pikepdf_text_strip)

    @property
    def visual_cover_page_indices(self) -> frozenset[int]:
        return frozenset(page_idx for page_idx, page in self.pages.items() if page.needs_visual_cover)

    @property
    def hidden_text_strip_page_indices(self) -> frozenset[int]:
        return frozenset(page_idx for page_idx, page in self.pages.items() if page.needs_hidden_text_strip)

    @property
    def route_reason_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for page in self.pages.values():
            key = page.kind
            counts[key] = counts.get(key, 0) + 1
        return counts

    def to_manifest(self) -> dict[str, Any]:
        return {
            "algorithm": self.algorithm,
            "pages": [page.to_manifest() for _idx, page in sorted(self.pages.items())],
            "route_reason_counts": self.route_reason_counts,
        }

    @classmethod
    def from_manifest(cls, value: object) -> "RenderDocumentAnalysis | None":
        payload = dict(value or {})
        if payload.get("algorithm") != RENDER_DOCUMENT_PROFILE_ALGORITHM_VERSION:
            return None
        pages: dict[int, RenderPageAnalysis] = {}
        for raw_page in payload.get("pages") if isinstance(payload.get("pages"), list) else []:
            page = RenderPageAnalysis.from_manifest(raw_page)
            if page is not None:
                pages[page.page_index] = page
        return cls(pages=pages) if pages else None


__all__ = [
    "RENDER_DOCUMENT_PROFILE_ALGORITHM_VERSION",
    "RenderDocumentAnalysis",
    "RenderPageAnalysis",
]
