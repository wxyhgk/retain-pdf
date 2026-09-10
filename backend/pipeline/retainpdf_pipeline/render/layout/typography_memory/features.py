from __future__ import annotations

from dataclasses import dataclass
from hashlib import blake2b
import json
from math import log1p

from retainpdf_pipeline.render.semantics.item_view import block_kind
from retainpdf_pipeline.render.semantics.item_view import layout_role
from retainpdf_pipeline.render.semantics.item_view import semantic_role
from retainpdf_pipeline.render.semantics.item_view import structure_role
from retainpdf_pipeline.render.layout.font_roles import is_title_like_block
from retainpdf_pipeline.render.layout.payload.shared import source_word_count
from retainpdf_pipeline.render.layout.payload.shared import translated_zh_char_count
from retainpdf_pipeline.render.layout.payload.shared import translation_density_ratio
from retainpdf_pipeline.render.layout.typography.measurement import bbox_height
from retainpdf_pipeline.render.layout.typography.measurement import bbox_width
from retainpdf_pipeline.render.layout.typography.measurement import formula_ratio
from retainpdf_pipeline.render.layout.typography.measurement import source_visual_line_count


TYPOGRAPHY_MEMORY_FEATURE_VERSION = "typography_memory_features_v1"


@dataclass(frozen=True)
class TypographyFeature:
    key: str
    payload: dict[str, object]


def build_typography_feature(
    *,
    item: dict,
    translated_text: str,
    font_size_pt: float,
    leading_em: float,
    page_width: float | None,
    page_height: float | None,
    page_text_width_med: float,
    is_body: bool,
    dense_small_box: bool,
    heavy_dense_small_box: bool,
    wide_aspect_body_text: bool,
    preserve_line_breaks: bool,
) -> TypographyFeature | None:
    width = bbox_width(item)
    height = bbox_height(item)
    if width <= 0 or height <= 0 or font_size_pt <= 0 or leading_em <= 0:
        return None
    page_width = float(page_width or 0.0)
    page_height = float(page_height or 0.0)
    source_words = source_word_count(item)
    zh_chars = translated_zh_char_count(translated_text)
    payload: dict[str, object] = {
        "version": TYPOGRAPHY_MEMORY_FEATURE_VERSION,
        "block_kind": block_kind(item),
        "layout_role": layout_role(item),
        "semantic_role": semantic_role(item),
        "structure_role": structure_role(item),
        "title": bool(is_title_like_block(item)),
        "body": bool(is_body),
        "dense": bool(dense_small_box),
        "heavy_dense": bool(heavy_dense_small_box),
        "wide_body": bool(wide_aspect_body_text),
        "preserve_lines": bool(preserve_line_breaks),
        "w_bin": _linear_bin(width, 12.0),
        "h_bin": _linear_bin(height, 8.0),
        "aspect_bin": _ratio_bin(width / max(height, 1.0)),
        "page_w_bin": _linear_bin(page_width, 40.0) if page_width > 0 else 0,
        "page_h_bin": _linear_bin(page_height, 40.0) if page_height > 0 else 0,
        "rel_w_bin": _ratio_bin(width / max(page_width, 1.0)) if page_width > 0 else 0,
        "rel_h_bin": _ratio_bin(height / max(page_height, 1.0)) if page_height > 0 else 0,
        "text_w_bin": _linear_bin(page_text_width_med, 12.0) if page_text_width_med > 0 else 0,
        "source_lines_bin": min(12, source_visual_line_count(item)),
        "source_words_bin": _log_bin(source_words),
        "zh_chars_bin": _log_bin(zh_chars),
        "density_bin": _ratio_bin(translation_density_ratio(item, translated_text)),
        "formula_bin": _ratio_bin(formula_ratio(item)),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return TypographyFeature(key=blake2b(raw, digest_size=16).hexdigest(), payload=payload)


def _linear_bin(value: float, step: float) -> int:
    return int(round(max(0.0, float(value)) / max(step, 0.1)))


def _log_bin(value: int | float) -> int:
    return int(round(log1p(max(0.0, float(value))) * 4.0))


def _ratio_bin(value: float) -> int:
    return int(round(max(0.0, min(float(value), 12.0)) * 10.0))


__all__ = [
    "TYPOGRAPHY_MEMORY_FEATURE_VERSION",
    "TypographyFeature",
    "build_typography_feature",
]
