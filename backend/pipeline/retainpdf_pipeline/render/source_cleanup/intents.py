from __future__ import annotations

from dataclasses import dataclass


SOURCE_ROLE_BODY_TEXT = "body_text"
SOURCE_ROLE_MATH_FORMULA = "math_formula"
SOURCE_ROLE_MIXED_MATH_TEXT = "mixed_math_text"
SOURCE_ROLE_TEXTUAL_FORMULA = "textual_formula"
SOURCE_ROLE_VISUAL_ASSET = "visual_asset"
SOURCE_ROLE_UNKNOWN = "unknown"

CLEANUP_ACTION_STRIP_TEXT = "strip_text"
CLEANUP_ACTION_PROTECT_SOURCE = "protect_source"
CLEANUP_ACTION_NOOP = "noop"
CLEANUP_ACTION_NEEDS_REVIEW = "needs_review"

TRANSLATION_STATE_TRANSLATED = "translated"
TRANSLATION_STATE_KEPT_ORIGIN = "kept_origin"
TRANSLATION_STATE_MISSING = "missing"
TRANSLATION_STATE_UNKNOWN = "unknown"

REPLACEMENT_KIND_TEXT_OVERLAY = "text_overlay"
REPLACEMENT_KIND_PRESERVE_SOURCE = "preserve_source"
REPLACEMENT_KIND_NONE = "none"


@dataclass(frozen=True)
class SourceCleanupEvidence:
    item: dict
    item_id: str
    block_kind: str
    has_formula_region: bool
    source_text: str
    output_text: str
    is_marked_non_translated: bool
    has_unresolved_embedded_formula: bool
    is_force_strip_text: bool


@dataclass(frozen=True)
class SourceCleanupIntent:
    item_id: str
    source_role: str
    translation_state: str
    replacement_kind: str
    cleanup_action: str
    confidence: float
    reasons: tuple[str, ...] = ()

    @property
    def should_strip_text(self) -> bool:
        return self.cleanup_action == CLEANUP_ACTION_STRIP_TEXT

    @property
    def should_protect_source(self) -> bool:
        return self.cleanup_action == CLEANUP_ACTION_PROTECT_SOURCE
