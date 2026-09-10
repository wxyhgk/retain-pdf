from __future__ import annotations

from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.analysis.profile.editable_text import has_editable_text
from retainpdf_pipeline.render.analysis.profile.text_traces import text_trace_visibility_counts


EDITABLE_TEXT_MIN_WORDS = 20


def page_word_count(page: fitz.Page) -> int:
    try:
        return len(page.get_text("words"))
    except Exception:
        return 0


@dataclass(frozen=True)
class TextLayerProfile:
    visible_traces: int
    hidden_traces: int
    has_visible_text: bool
    has_hidden_text: bool
    editable: bool


def build_text_layer_profile(page: fitz.Page) -> TextLayerProfile:
    visible, hidden = text_trace_visibility_counts(page)
    words = page_word_count(page)
    has_visible_text = visible > 0 or words >= EDITABLE_TEXT_MIN_WORDS
    return TextLayerProfile(
        visible_traces=visible,
        hidden_traces=hidden,
        has_visible_text=has_visible_text,
        has_hidden_text=hidden > 0,
        editable=has_editable_text(visible) or words >= EDITABLE_TEXT_MIN_WORDS,
    )
