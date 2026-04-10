from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from dataclasses import replace

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


@dataclass(frozen=True)
class FallbackPolicy:
    plain_text_attempts: int = 4
    formula_segment_attempts: int = 4
    allow_tagged_placeholder_retry: bool = True
    allow_keep_origin_degradation: bool = True


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
) -> TranslationControlContext:
    return TranslationControlContext(
        mode=mode,
        domain_guidance=domain_guidance,
        rule_guidance=rule_guidance,
        extra_guidance=extra_guidance,
        request_label=request_label,
        glossary_entries=list(glossary_entries or []),
        abbreviation_entries=list(abbreviation_entries or []),
        retrieval_entries=list(retrieval_entries or []),
    )
