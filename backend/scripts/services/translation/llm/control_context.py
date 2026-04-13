from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from dataclasses import replace

from services.translation.diagnostics import classify_provider_family
from services.translation.terms import AbbreviationEntry
from services.translation.terms import GlossaryEntry
from services.translation.terms import build_terms_guidance


@dataclass(frozen=True)
class PlaceholderPolicy:
    reject_unexpected_placeholders: bool = True
    reject_inventory_mismatch: bool = True
    allow_internal_keep_origin_degradation: bool = True


@dataclass(frozen=True)
class SegmentationPolicy:
    max_formula_segment_count: int = 16
    formula_segment_window_target_count: int = 8
    formula_segment_window_max_chars: int = 1200
    formula_segment_window_neighbor_context: int = 2
    prefer_plain_when_segment_count_leq: int = 4
    small_formula_inline_enabled: bool = True
    small_formula_inline_max_placeholders: int = 3
    small_formula_inline_max_segments: int = 4
    small_formula_inline_min_chars: int = 60
    small_formula_inline_max_chars: int = 700
    small_formula_inline_score_threshold: int = 4


@dataclass(frozen=True)
class FallbackPolicy:
    plain_text_attempts: int = 4
    formula_segment_attempts: int = 4
    allow_tagged_placeholder_retry: bool = True
    allow_keep_origin_degradation: bool = True


@dataclass(frozen=True)
class TimeoutPolicy:
    plain_text_seconds: int = 35
    batch_plain_text_seconds: int = 45
    formula_segment_seconds: int = 60
    formula_window_seconds: int = 75


@dataclass(frozen=True)
class BatchPolicy:
    plain_batch_size: int = 4
    batch_low_risk_max_chars: int = 600
    batch_low_risk_max_placeholders: int = 4


@dataclass(frozen=True)
class EngineProfile:
    name: str = "balanced"
    timeout_policy: TimeoutPolicy = field(default_factory=TimeoutPolicy)
    batch_policy: BatchPolicy = field(default_factory=BatchPolicy)
    segmentation_policy: SegmentationPolicy = field(default_factory=SegmentationPolicy)
    fallback_policy: FallbackPolicy = field(default_factory=FallbackPolicy)


@dataclass(frozen=True)
class RetrievalEvidence:
    source: str
    content: str
    score: float | None = None

    def to_guidance_line(self) -> str:
        prefix = f"[{self.source.strip() or 'retrieval'}]"
        text = (self.content or "").strip()
        if self.score is None:
            return f"- {prefix} {text}"
        return f"- {prefix} (score={self.score:.3f}) {text}"


@dataclass(frozen=True)
class TranslationControlContext:
    mode: str = "fast"
    domain_guidance: str = ""
    rule_guidance: str = ""
    extra_guidance: str = ""
    request_label: str = ""
    placeholder_policy: PlaceholderPolicy = field(default_factory=PlaceholderPolicy)
    segmentation_policy: SegmentationPolicy = field(default_factory=SegmentationPolicy)
    fallback_policy: FallbackPolicy = field(default_factory=FallbackPolicy)
    timeout_policy: TimeoutPolicy = field(default_factory=TimeoutPolicy)
    batch_policy: BatchPolicy = field(default_factory=BatchPolicy)
    engine_profile_name: str = "balanced"
    glossary_entries: list[GlossaryEntry] = field(default_factory=list)
    abbreviation_entries: list[AbbreviationEntry] = field(default_factory=list)
    retrieval_entries: list[RetrievalEvidence] = field(default_factory=list)

    @property
    def terms_guidance(self) -> str:
        return build_terms_guidance(
            glossary_entries=self.glossary_entries,
            abbreviation_entries=self.abbreviation_entries,
        )

    @property
    def retrieval_guidance(self) -> str:
        if not self.retrieval_entries:
            return ""
        lines = ["Retrieved reference context:"]
        lines.extend(
            entry.to_guidance_line()
            for entry in self.retrieval_entries
            if (entry.content or "").strip()
        )
        if len(lines) == 1:
            return ""
        return "\n".join(lines)

    @property
    def merged_guidance(self) -> str:
        parts = []
        for value in (
            self.domain_guidance,
            self.rule_guidance,
            self.terms_guidance,
            self.retrieval_guidance,
            self.extra_guidance,
        ):
            text = (value or "").strip()
            if text:
                parts.append(text)
        return "\n\n".join(parts).strip()

    @property
    def cache_guidance(self) -> str:
        parts = []
        for value in (
            self.domain_guidance,
            self.rule_guidance,
            self.retrieval_guidance,
            self.extra_guidance,
        ):
            text = (value or "").strip()
            if text:
                parts.append(text)
        return "\n\n".join(parts).strip()

    def with_request_label(self, request_label: str) -> "TranslationControlContext":
        return replace(self, request_label=request_label)


def build_translation_control_context(
    *,
    mode: str = "fast",
    domain_guidance: str = "",
    rule_guidance: str = "",
    extra_guidance: str = "",
    request_label: str = "",
    glossary_entries: list[GlossaryEntry] | None = None,
    abbreviation_entries: list[AbbreviationEntry] | None = None,
    retrieval_entries: list[RetrievalEvidence] | None = None,
    engine_profile: EngineProfile | None = None,
) -> TranslationControlContext:
    resolved_profile = engine_profile or EngineProfile()
    return TranslationControlContext(
        mode=mode,
        domain_guidance=domain_guidance,
        rule_guidance=rule_guidance,
        extra_guidance=extra_guidance,
        request_label=request_label,
        segmentation_policy=resolved_profile.segmentation_policy,
        fallback_policy=resolved_profile.fallback_policy,
        timeout_policy=resolved_profile.timeout_policy,
        batch_policy=resolved_profile.batch_policy,
        engine_profile_name=resolved_profile.name,
        glossary_entries=list(glossary_entries or []),
        abbreviation_entries=list(abbreviation_entries or []),
        retrieval_entries=list(retrieval_entries or []),
    )


def resolve_engine_profile(*, model: str = "", base_url: str = "") -> EngineProfile:
    normalized_model = (model or "").strip().lower()
    provider_family = classify_provider_family(base_url=base_url, model=model)
    profile = EngineProfile()
    if normalized_model.startswith("qwen35-9b-q4km") or normalized_model.startswith("qwen-35-9b-q4km"):
        return replace(
            profile,
            name="qwen35_low_concurrency_fast",
            segmentation_policy=replace(
                profile.segmentation_policy,
                prefer_plain_when_segment_count_leq=6,
            ),
            fallback_policy=replace(
                profile.fallback_policy,
                formula_segment_attempts=2,
            ),
        )
    if provider_family == "deepseek_official":
        return replace(
            profile,
            name="deepseek_balanced",
            segmentation_policy=replace(
                profile.segmentation_policy,
                prefer_plain_when_segment_count_leq=6,
            ),
            fallback_policy=replace(
                profile.fallback_policy,
                formula_segment_attempts=2,
            ),
            batch_policy=replace(profile.batch_policy, plain_batch_size=6),
        )
    return profile
