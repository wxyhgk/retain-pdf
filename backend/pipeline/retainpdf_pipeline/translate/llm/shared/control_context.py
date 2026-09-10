from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from dataclasses import replace
from collections.abc import Iterable
from typing import Any

from retainpdf_pipeline.translate.artifacts import classify_provider_family
from retainpdf_pipeline.translate.core.terms import AbbreviationEntry
from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import build_terms_guidance
from retainpdf_pipeline.translate.core.terms import matched_abbreviation_entries
from retainpdf_pipeline.translate.core.terms import matched_glossary_entries
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.llm.shared.tail_retry_queue import TranslationTailQueue


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
    plain_text_attempts: int = 2
    formula_segment_attempts: int = 2
    allow_tagged_placeholder_retry: bool = True
    allow_keep_origin_degradation: bool = True
    transport_tail_retry_passes: int = 1
    main_http_retry_attempts: int = 1
    tail_http_retry_attempts: int = 2


@dataclass(frozen=True)
class TimeoutPolicy:
    plain_text_seconds: int = 35
    batch_plain_text_seconds: int = 45
    formula_segment_seconds: int = 60
    formula_window_seconds: int = 75
    long_plain_text_seconds: int = 55
    transport_tail_retry_seconds: int = 70


@dataclass(frozen=True)
class BatchPolicy:
    # 多条目 tagged 批处理已退役:批越大,模型损坏输出协议(如把末尾
    # <<<END>>> 打成 <<<END>>,实测 1/6 复现)导致整批作废重译的概率越高。
    # 稳定性优先,生产路径一律单条 plain-text 请求;机制代码保留,
    # 需要 A/B 时改这里即可。
    plain_batch_size: int = 1
    batch_low_risk_min_chars: int = 16
    batch_low_risk_max_chars: int = 1200
    batch_low_risk_max_placeholders: int = 8


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
    source_lang: str = "auto"
    target_lang: str = "zh-CN"
    target_language_name: str = "简体中文"
    domain_guidance: str = ""
    rule_guidance: str = ""
    extra_guidance: str = ""
    request_label: str = ""
    context_mode: str = "needed"
    glossary_mode: str = "matched"
    memory_mode: str = "matched"
    placeholder_policy: PlaceholderPolicy = field(default_factory=PlaceholderPolicy)
    segmentation_policy: SegmentationPolicy = field(default_factory=SegmentationPolicy)
    fallback_policy: FallbackPolicy = field(default_factory=FallbackPolicy)
    timeout_policy: TimeoutPolicy = field(default_factory=TimeoutPolicy)
    batch_policy: BatchPolicy = field(default_factory=BatchPolicy)
    engine_profile_name: str = "balanced"
    glossary_entries: list[GlossaryEntry] = field(default_factory=list)
    abbreviation_entries: list[AbbreviationEntry] = field(default_factory=list)
    retrieval_entries: list[RetrievalEvidence] = field(default_factory=list)
    term_scope_source_text_count: int = 0
    term_scope_glossary_total_count: int = 0
    term_scope_abbreviation_total_count: int = 0
    translation_tail_queue: TranslationTailQueue | None = None
    transport_tail_retry_queue: TranslationTailQueue | None = None
    _term_scope_cache: dict[tuple[str, ...], tuple[list[GlossaryEntry], list[AbbreviationEntry]]] = field(
        default_factory=dict,
        compare=False,
        repr=False,
    )

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
    def prompt_system_guidance(self) -> str:
        # 进 system 消息的运行期常量部分:不含 terms_guidance。词表经
        # scoped_to_item 按条目匹配后是逐条变化的,放进 system 会让每条
        # 请求的前缀都不同,直接打掉 provider 前缀缓存(预热白做)。
        # 匹配到的术语改经 item 注入 user 消息;cache_guidance 仍含术语,
        # 缓存正确性不受影响。
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

    @property
    def cache_guidance(self) -> str:
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

    def scoped_to_source_texts(self, texts: Iterable[str]) -> "TranslationControlContext":
        text_list = [text for text in texts if text]
        glossary_mode = _normalize_glossary_mode(self.glossary_mode)
        if glossary_mode == "off":
            return replace(
                self,
                glossary_entries=[],
                abbreviation_entries=[],
                term_scope_source_text_count=len(text_list),
                term_scope_glossary_total_count=len(self.glossary_entries),
                term_scope_abbreviation_total_count=len(self.abbreviation_entries),
            )
        if glossary_mode == "all":
            return self
        if not text_list or not (self.glossary_entries or self.abbreviation_entries):
            return self
        cache_key = tuple(text_list)
        cached_scope = self._term_scope_cache.get(cache_key)
        if cached_scope is None:
            source_text = "\n".join(text_list)
            cached_scope = (
                matched_glossary_entries(self.glossary_entries, source_text),
                matched_abbreviation_entries(self.abbreviation_entries, source_text),
            )
            self._term_scope_cache[cache_key] = cached_scope
        matched_glossary, matched_abbreviations = cached_scope
        if len(matched_glossary) == len(self.glossary_entries) and len(matched_abbreviations) == len(self.abbreviation_entries):
            return self
        return replace(
            self,
            glossary_entries=matched_glossary,
            abbreviation_entries=matched_abbreviations,
            term_scope_source_text_count=len(text_list),
            term_scope_glossary_total_count=len(self.glossary_entries),
            term_scope_abbreviation_total_count=len(self.abbreviation_entries),
        )

    def term_scope_summary_for_source_texts(self, texts: Iterable[str]) -> dict[str, Any]:
        text_list = [text for text in texts if text]
        scoped = self.scoped_to_source_texts(text_list)
        source_text_count = scoped.term_scope_source_text_count
        if source_text_count <= 0:
            source_text_count = len(text_list)
        glossary_total = scoped.term_scope_glossary_total_count or len(self.glossary_entries)
        abbreviation_total = scoped.term_scope_abbreviation_total_count or len(self.abbreviation_entries)
        return {
            "source_text_count": source_text_count,
            "glossary_total_count": glossary_total,
            "glossary_matched_count": len(scoped.glossary_entries),
            "glossary_sources": [entry.source for entry in scoped.glossary_entries],
            "abbreviation_total_count": abbreviation_total,
            "abbreviation_matched_count": len(scoped.abbreviation_entries),
            "abbreviation_sources": [entry.source for entry in scoped.abbreviation_entries],
        }

    def term_scope_summary_for_item(self, item: dict) -> dict[str, Any]:
        source_text = str(
            item.get("source_text")
            or item.get("raw_source_text")
            or item.get("mixed_original_protected_source_text")
            or item.get("translation_unit_original_source_text")
            or item.get("translation_unit_protected_source_text")
            or item.get("group_protected_source_text")
            or item.get("protected_source_text")
            or ""
        )
        return self.term_scope_summary_for_source_texts([source_text])

    def scoped_to_item(self, item: dict) -> "TranslationControlContext":
        source_text = str(
            item.get("translation_unit_protected_source_text")
            or item.get("group_protected_source_text")
            or item.get("protected_source_text")
            or item.get("source_text")
            or ""
        )
        return self.scoped_to_source_texts([source_text])

    def scoped_to_batch(self, batch: list[dict]) -> "TranslationControlContext":
        return self.scoped_to_source_texts(
            str(
                item.get("translation_unit_protected_source_text")
                or item.get("group_protected_source_text")
                or item.get("protected_source_text")
                or item.get("source_text")
                or ""
            )
            for item in batch
        )


def build_translation_control_context(
    *,
    mode: str = "fast",
    source_lang: str = "auto",
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
    domain_guidance: str = "",
    rule_guidance: str = "",
    extra_guidance: str = "",
    request_label: str = "",
    context_mode: str = "needed",
    glossary_mode: str = "matched",
    memory_mode: str = "matched",
    glossary_entries: list[GlossaryEntry] | None = None,
    abbreviation_entries: list[AbbreviationEntry] | None = None,
    retrieval_entries: list[RetrievalEvidence] | None = None,
    engine_profile: EngineProfile | None = None,
) -> TranslationControlContext:
    resolved_profile = engine_profile or EngineProfile()
    tail_queue = TranslationTailQueue()
    return TranslationControlContext(
        mode=mode,
        source_lang=source_lang,
        target_lang=target_lang,
        target_language_name=target_language_name,
        domain_guidance=domain_guidance,
        rule_guidance=rule_guidance,
        extra_guidance=extra_guidance,
        request_label=request_label,
        context_mode=_normalize_context_mode(context_mode),
        glossary_mode=_normalize_glossary_mode(glossary_mode),
        memory_mode=_normalize_memory_mode(memory_mode),
        segmentation_policy=resolved_profile.segmentation_policy,
        fallback_policy=resolved_profile.fallback_policy,
        timeout_policy=resolved_profile.timeout_policy,
        batch_policy=resolved_profile.batch_policy,
        engine_profile_name=resolved_profile.name,
        glossary_entries=normalize_glossary_entries(glossary_entries),
        abbreviation_entries=list(abbreviation_entries or []),
        retrieval_entries=list(retrieval_entries or []),
        translation_tail_queue=tail_queue,
        transport_tail_retry_queue=tail_queue,
    )


def _normalize_context_mode(value: str) -> str:
    normalized = str(value or "needed").strip().lower()
    if normalized in {"needed", "all", "off"}:
        return normalized
    return "needed"


def _normalize_glossary_mode(value: str) -> str:
    normalized = str(value or "matched").strip().lower()
    if normalized in {"matched", "all", "off"}:
        return normalized
    return "matched"


def _normalize_memory_mode(value: str) -> str:
    normalized = str(value or "matched").strip().lower()
    if normalized in {"matched", "broad", "off"}:
        return normalized
    return "matched"


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
            batch_policy=replace(profile.batch_policy, plain_batch_size=1),
        )
    if provider_family == "deepseek_official":
        return replace(
            profile,
            name="deepseek_balanced",
            timeout_policy=replace(
                profile.timeout_policy,
                plain_text_seconds=20,
                batch_plain_text_seconds=25,
                long_plain_text_seconds=30,
                transport_tail_retry_seconds=40,
            ),
            segmentation_policy=replace(
                profile.segmentation_policy,
                prefer_plain_when_segment_count_leq=6,
            ),
            fallback_policy=replace(
                profile.fallback_policy,
                formula_segment_attempts=2,
            ),
        )
    return profile
