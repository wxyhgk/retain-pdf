from __future__ import annotations

from services.translation.llm.control_context import RetrievalEvidence
from services.translation.llm.control_context import TranslationControlContext
from services.translation.llm.control_context import build_translation_control_context
from services.translation.llm.control_context import resolve_engine_profile
from services.translation.policy import TranslationPolicyConfig
from services.translation.terms import AbbreviationEntry
from services.translation.terms import GlossaryEntry
from services.translation.terms import normalize_glossary_entries


def build_translation_context(
    *,
    mode: str = "fast",
    domain_guidance: str = "",
    rule_guidance: str = "",
    extra_guidance: str = "",
    request_label: str = "",
    glossary_entries: list[GlossaryEntry] | None = None,
    abbreviation_entries: list[AbbreviationEntry] | None = None,
    retrieval_entries: list[RetrievalEvidence] | None = None,
    model: str = "",
    base_url: str = "",
) -> TranslationControlContext:
    return build_translation_control_context(
        mode=mode,
        domain_guidance=domain_guidance,
        rule_guidance=rule_guidance,
        extra_guidance=extra_guidance,
        request_label=request_label,
        glossary_entries=glossary_entries,
        abbreviation_entries=abbreviation_entries,
        retrieval_entries=retrieval_entries,
        engine_profile=resolve_engine_profile(model=model, base_url=base_url),
    )


def build_translation_context_from_policy(
    policy_config: TranslationPolicyConfig,
    *,
    request_label: str = "",
    extra_guidance: str = "",
    glossary_entries: list[GlossaryEntry] | None = None,
    abbreviation_entries: list[AbbreviationEntry] | None = None,
    retrieval_entries: list[RetrievalEvidence] | None = None,
    model: str = "",
    base_url: str = "",
) -> TranslationControlContext:
    return build_translation_context(
        mode=policy_config.mode,
        domain_guidance=(policy_config.domain_context.get("translation_guidance") or "").strip(),
        rule_guidance=policy_config.rule_guidance,
        extra_guidance=extra_guidance,
        request_label=request_label,
        glossary_entries=normalize_glossary_entries(glossary_entries),
        abbreviation_entries=abbreviation_entries,
        retrieval_entries=retrieval_entries,
        model=model,
        base_url=base_url,
    )


__all__ = [
    "build_translation_context",
    "build_translation_context_from_policy",
    "RetrievalEvidence",
    "TranslationControlContext",
]
