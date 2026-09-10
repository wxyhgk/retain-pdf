from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import fitz

from retainpdf_pipeline.render.source_cleanup.planning.page_probe import page_content_stream_size
from retainpdf_pipeline.render.source_cleanup.planning.page_probe import page_has_form_xobjects


@dataclass(frozen=True)
class PageCleanupFeatures:
    content_stream_size: int = 0
    has_form_xobjects: bool = False

    def to_manifest(self) -> dict[str, Any]:
        return {
            "content_stream_size": int(self.content_stream_size),
            "has_form_xobjects": bool(self.has_form_xobjects),
        }

    @classmethod
    def from_manifest(cls, value: object) -> "PageCleanupFeatures | None":
        payload = dict(value or {})
        if not payload:
            return None
        return cls(
            content_stream_size=_int_or_zero(payload.get("content_stream_size")),
            has_form_xobjects=bool(payload.get("has_form_xobjects")),
        )


def build_page_cleanup_features(doc: fitz.Document, page: fitz.Page) -> PageCleanupFeatures:
    return PageCleanupFeatures(
        content_stream_size=page_content_stream_size(doc, page),
        has_form_xobjects=page_has_form_xobjects(page),
    )


def _int_or_zero(value: object) -> int:
    try:
        return max(0, int(value))
    except Exception:
        return 0
