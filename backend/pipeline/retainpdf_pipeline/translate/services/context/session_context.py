from __future__ import annotations

from retainpdf_pipeline.translate.llm.shared.control_context import RetrievalEvidence
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.llm.shared.control_context import resolve_engine_profile
from retainpdf_pipeline.translate.services.policy import TranslationPolicyConfig
from retainpdf_pipeline.translate.services.terms import AbbreviationEntry
from retainpdf_pipeline.translate.services.terms import GlossaryEntry
from retainpdf_pipeline.translate.services.terms import normalize_glossary_entries


def build_translation_context(
    *,
    mode: str = "fast",
    source_lang: str = "auto",
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
    domain_guidance: str = "",
    rule_guidance: str = "",
    extra_guidance: str = "",
    request_label: str = "",
    glossary_entries: list[GlossaryEntry] | None = None,
    abbreviation_entries: list[AbbreviationEntry] | None = None,
    retrieval_entries: list[RetrievalEvidence] | None = None,
    model: str = "",
    base_url: str = "",
    context_mode: str = "needed",
    glossary_mode: str = "matched",
    memory_mode: str = "matched",
) -> TranslationControlContext:
    return build_translation_control_context(
        mode=mode,
        source_lang=source_lang,
        target_lang=target_lang,
        target_language_name=target_language_name,
        domain_guidance=domain_guidance,
        rule_guidance=rule_guidance,
        extra_guidance=extra_guidance,
        request_label=request_label,
        glossary_entries=glossary_entries,
        abbreviation_entries=abbreviation_entries,
        retrieval_entries=retrieval_entries,
        context_mode=context_mode,
        glossary_mode=glossary_mode,
        memory_mode=memory_mode,
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
    context_mode: str = "needed",
    glossary_mode: str = "matched",
    memory_mode: str = "matched",
) -> TranslationControlContext:
    extra_guidance_parts: list[str] = []
    if extra_guidance.strip():
        extra_guidance_parts.append(extra_guidance.strip())
    if str(getattr(policy_config, "math_mode", "placeholder") or "placeholder").strip() == "direct_typst":
        extra_guidance_parts.append(
            "Math output mode: direct_typst.\n"
            "When the source contains formulas, output the final translated text directly with inline math preserved "
            "using `$...$` spans when needed.\n"
            "Do not emit placeholder tokens, JSON shells, labels, or explanations."
        )
    return build_translation_context(
        mode=policy_config.mode,
        domain_guidance=policy_config.document_domain_guidance,
        rule_guidance=policy_config.rule_guidance,
        extra_guidance="\n\n".join(extra_guidance_parts).strip(),
        request_label=request_label,
        glossary_entries=normalize_glossary_entries(glossary_entries),
        abbreviation_entries=abbreviation_entries,
        retrieval_entries=retrieval_entries,
        model=model,
        base_url=base_url,
        context_mode=context_mode,
        glossary_mode=glossary_mode,
        memory_mode=memory_mode,
    )


__all__ = [
    "build_translation_context",
    "build_translation_context_from_policy",
    "RetrievalEvidence",
    "TranslationControlContext",
]
