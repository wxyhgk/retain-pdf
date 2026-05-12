from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.analysis.profile.editable_text import has_editable_text
from services.rendering.analysis.profile.text_traces import text_trace_visibility_counts


@dataclass(frozen=True)
class TextLayerProfile:
    visible_traces: int
    hidden_traces: int
    has_visible_text: bool
    has_hidden_text: bool
    editable: bool


def build_text_layer_profile(page: fitz.Page) -> TextLayerProfile:
    visible, hidden = text_trace_visibility_counts(page)
    return TextLayerProfile(
        visible_traces=visible,
        hidden_traces=hidden,
        has_visible_text=visible > 0,
        has_hidden_text=hidden > 0,
        editable=has_editable_text(visible),
    )
