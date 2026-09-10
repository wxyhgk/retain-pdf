from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.render.source_cleanup.intents import CLEANUP_ACTION_NOOP
from retainpdf_pipeline.render.source_cleanup.intents import CLEANUP_ACTION_PROTECT_SOURCE
from retainpdf_pipeline.render.source_cleanup.intents import CLEANUP_ACTION_STRIP_TEXT
from retainpdf_pipeline.render.source_cleanup.intents import REPLACEMENT_KIND_NONE
from retainpdf_pipeline.render.source_cleanup.intents import REPLACEMENT_KIND_PRESERVE_SOURCE
from retainpdf_pipeline.render.source_cleanup.intents import REPLACEMENT_KIND_TEXT_OVERLAY
from retainpdf_pipeline.render.source_cleanup.intents import SOURCE_ROLE_BODY_TEXT
from retainpdf_pipeline.render.source_cleanup.intents import SOURCE_ROLE_MATH_FORMULA
from retainpdf_pipeline.render.source_cleanup.intents import SOURCE_ROLE_MIXED_MATH_TEXT
from retainpdf_pipeline.render.source_cleanup.intents import SOURCE_ROLE_TEXTUAL_FORMULA
from retainpdf_pipeline.render.source_cleanup.intents import SOURCE_ROLE_UNKNOWN
from retainpdf_pipeline.render.source_cleanup.intents import TRANSLATION_STATE_KEPT_ORIGIN
from retainpdf_pipeline.render.source_cleanup.intents import TRANSLATION_STATE_MISSING
from retainpdf_pipeline.render.source_cleanup.intents import TRANSLATION_STATE_TRANSLATED
from retainpdf_pipeline.render.source_cleanup.intents import TRANSLATION_STATE_UNKNOWN
from retainpdf_pipeline.render.source_cleanup.intents import SourceCleanupEvidence
from retainpdf_pipeline.render.source_cleanup.intents import SourceCleanupIntent
from retainpdf_pipeline.render.source_cleanup.planning.formula_classifier import formula_text_has_latin_words


IntentPredicate = Callable[[SourceCleanupEvidence], bool]
IntentBuilder = Callable[[SourceCleanupEvidence], SourceCleanupIntent]


@dataclass(frozen=True)
class IntentRule:
    name: str
    matches: IntentPredicate
    build: IntentBuilder


INTENT_RULES: tuple[IntentRule, ...] = (
    IntentRule(
        name="translated_force_strip_text",
        matches=lambda evidence: evidence.block_kind == "text"
        and evidence_has_text_overlay(evidence)
        and evidence.is_force_strip_text,
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_BODY_TEXT,
            translation_state=TRANSLATION_STATE_TRANSLATED,
            replacement_kind=REPLACEMENT_KIND_TEXT_OVERLAY,
            cleanup_action=CLEANUP_ACTION_STRIP_TEXT,
            confidence=0.98,
            reason="translated_force_strip_text_overlay",
        ),
    ),
    IntentRule(
        name="translated_body_text_with_unresolved_embedded_formula",
        matches=lambda evidence: evidence.block_kind == "text"
        and evidence_has_text_overlay(evidence)
        and evidence.has_unresolved_embedded_formula,
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_MIXED_MATH_TEXT,
            translation_state=TRANSLATION_STATE_TRANSLATED,
            replacement_kind=REPLACEMENT_KIND_PRESERVE_SOURCE,
            cleanup_action=CLEANUP_ACTION_PROTECT_SOURCE,
            confidence=0.7,
            reason="mixed_text_embedded_formula_without_subregions",
        ),
    ),
    IntentRule(
        name="translated_body_text",
        matches=lambda evidence: evidence.block_kind == "text" and evidence_has_text_overlay(evidence),
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_BODY_TEXT,
            translation_state=TRANSLATION_STATE_TRANSLATED,
            replacement_kind=REPLACEMENT_KIND_TEXT_OVERLAY,
            cleanup_action=CLEANUP_ACTION_STRIP_TEXT,
            confidence=0.95,
            reason="translated_body_text_overlay",
        ),
    ),
    IntentRule(
        name="untranslated_body_text",
        matches=lambda evidence: evidence.block_kind == "text",
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_BODY_TEXT,
            translation_state=translation_state_for_evidence(evidence),
            replacement_kind=REPLACEMENT_KIND_PRESERVE_SOURCE,
            cleanup_action=CLEANUP_ACTION_NOOP,
            confidence=0.9,
            reason="body_text_without_overlay",
        ),
    ),
    IntentRule(
        name="textual_formula_with_overlay",
        matches=lambda evidence: evidence.has_formula_region
        and formula_text_has_latin_words(evidence.item)
        and evidence_has_text_overlay(evidence),
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_TEXTUAL_FORMULA,
            translation_state=TRANSLATION_STATE_TRANSLATED,
            replacement_kind=REPLACEMENT_KIND_TEXT_OVERLAY,
            cleanup_action=CLEANUP_ACTION_STRIP_TEXT,
            confidence=0.78,
            reason="textual_formula_with_overlay",
        ),
    ),
    IntentRule(
        name="textual_formula_without_overlay",
        matches=lambda evidence: evidence.has_formula_region and formula_text_has_latin_words(evidence.item),
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_TEXTUAL_FORMULA,
            translation_state=translation_state_for_evidence(evidence),
            replacement_kind=REPLACEMENT_KIND_PRESERVE_SOURCE,
            cleanup_action=CLEANUP_ACTION_PROTECT_SOURCE,
            confidence=0.72,
            reason="textual_formula_without_overlay_preserve_source",
        ),
    ),
    IntentRule(
        name="math_formula",
        matches=lambda evidence: evidence.has_formula_region,
        build=lambda evidence: build_intent(
            evidence,
            source_role=SOURCE_ROLE_MATH_FORMULA,
            translation_state=TRANSLATION_STATE_KEPT_ORIGIN,
            replacement_kind=REPLACEMENT_KIND_PRESERVE_SOURCE,
            cleanup_action=CLEANUP_ACTION_PROTECT_SOURCE,
            confidence=0.82,
            reason="math_formula_preserve_source",
        ),
    ),
)


def classify_source_cleanup_intent(item: dict) -> SourceCleanupIntent:
    from retainpdf_pipeline.render.source_cleanup.planning.evidence import build_source_cleanup_evidence

    return classify_source_cleanup_evidence(build_source_cleanup_evidence(item))


def classify_source_cleanup_evidence(evidence: SourceCleanupEvidence) -> SourceCleanupIntent:
    matched_rule = next((rule for rule in INTENT_RULES if rule.matches(evidence)), None)
    if matched_rule is None:
        return build_intent(
            evidence,
            source_role=SOURCE_ROLE_UNKNOWN,
            translation_state=TRANSLATION_STATE_UNKNOWN,
            replacement_kind=REPLACEMENT_KIND_NONE,
            cleanup_action=CLEANUP_ACTION_NOOP,
            confidence=0.5,
            reason="no_cleanup_rule_matched",
        )
    return matched_rule.build(evidence)


def evidence_has_text_overlay(evidence: SourceCleanupEvidence) -> bool:
    return bool(evidence.output_text) and not evidence.is_marked_non_translated


def translation_state_for_evidence(evidence: SourceCleanupEvidence) -> str:
    if evidence_has_text_overlay(evidence):
        return TRANSLATION_STATE_TRANSLATED
    if evidence.is_marked_non_translated:
        return TRANSLATION_STATE_KEPT_ORIGIN
    return TRANSLATION_STATE_MISSING


def build_intent(
    evidence: SourceCleanupEvidence,
    *,
    source_role: str,
    translation_state: str,
    replacement_kind: str,
    cleanup_action: str,
    confidence: float,
    reason: str,
) -> SourceCleanupIntent:
    return SourceCleanupIntent(
        item_id=evidence.item_id,
        source_role=source_role,
        translation_state=translation_state,
        replacement_kind=replacement_kind,
        cleanup_action=cleanup_action,
        confidence=confidence,
        reasons=(reason,),
    )
