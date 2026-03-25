from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

from translation.ocr.json_extractor import extract_text_items
from translation.policy.reference_section import resolve_reference_cutoff
from translation.policy.rule_profiles import DEFAULT_RULE_PROFILE_NAME
from translation.policy.rule_profiles import build_rule_profile_context


@dataclass(frozen=True)
class TranslationPolicyConfig:
    mode: str
    enable_title_skip: bool = False
    enable_after_last_title_cutoff: bool = False
    enable_reference_zone_skip: bool = False
    enable_narrow_body_noise_skip: bool = False
    enable_metadata_fragment_skip: bool = False
    metadata_fragment_max_page_idx: int = 1
    enable_candidate_continuation_review: bool = True
    enable_domain_inference: bool = False
    sci_cutoff_page_idx: int | None = None
    sci_cutoff_block_idx: int | None = None
    domain_context: dict[str, str] = field(default_factory=dict)
    rule_profile_name: str = DEFAULT_RULE_PROFILE_NAME
    rule_profile_text: str = ""
    custom_rules_text: str = ""

    @property
    def domain_guidance(self) -> str:
        parts = []
        domain_guidance = (self.domain_context.get("translation_guidance") or "").strip()
        if domain_guidance:
            parts.append(domain_guidance)
        if self.rule_profile_text.strip():
            parts.append(f"Rule profile ({self.rule_profile_name}):\n{self.rule_profile_text.strip()}")
        if self.custom_rules_text.strip():
            parts.append(f"Custom rules:\n{self.custom_rules_text.strip()}")
        return "\n\n".join(parts).strip()

    @property
    def rule_guidance(self) -> str:
        parts = []
        if self.rule_profile_text.strip():
            parts.append(f"Rule profile ({self.rule_profile_name}):\n{self.rule_profile_text.strip()}")
        if self.custom_rules_text.strip():
            parts.append(f"Custom rules:\n{self.custom_rules_text.strip()}")
        return "\n\n".join(parts).strip()


def should_skip_title_translation(mode: str, skip_title_translation: bool) -> bool:
    return mode in {"precise", "sci"} or skip_title_translation


def should_apply_after_last_title_cutoff(mode: str) -> bool:
    return mode == "sci"


def should_apply_reference_zone_skip(mode: str) -> bool:
    return False


def should_apply_narrow_body_noise_skip(mode: str) -> bool:
    return False


def should_apply_metadata_fragment_skip(mode: str) -> bool:
    return False


def should_apply_candidate_continuation_review() -> bool:
    return True


def should_infer_domain_context(mode: str, source_pdf_path: Path | None) -> bool:
    return mode == "sci" and source_pdf_path is not None


def extract_ocr_preview_text(data: dict, max_pages: int = 2) -> str:
    pages = data.get("pdf_info", [])
    parts: list[str] = []
    for page_idx in range(min(max_pages, len(pages))):
        items = extract_text_items(data, page_idx=page_idx)
        page_texts = [item.text.strip() for item in items if item.text.strip()]
        if page_texts:
            parts.append(f"[Page {page_idx + 1}]\n" + "\n".join(page_texts))
    return "\n\n".join(parts).strip()


def build_translation_policy_config(
    *,
    mode: str,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None = None,
    sci_cutoff_block_idx: int | None = None,
    domain_context: dict[str, str] | None = None,
    rule_profile_name: str = DEFAULT_RULE_PROFILE_NAME,
    custom_rules_text: str = "",
    enable_title_skip: bool | None = None,
    enable_after_last_title_cutoff: bool | None = None,
    enable_reference_zone_skip: bool | None = None,
    enable_narrow_body_noise_skip: bool | None = None,
    enable_metadata_fragment_skip: bool | None = None,
    metadata_fragment_max_page_idx: int | None = None,
    enable_candidate_continuation_review: bool | None = None,
    enable_domain_inference: bool | None = None,
) -> TranslationPolicyConfig:
    rule_profile = build_rule_profile_context(rule_profile_name, custom_rules_text)
    return TranslationPolicyConfig(
        mode=mode,
        enable_title_skip=should_skip_title_translation(mode, skip_title_translation)
        if enable_title_skip is None
        else enable_title_skip,
        enable_after_last_title_cutoff=should_apply_after_last_title_cutoff(mode)
        and sci_cutoff_page_idx is not None
        and sci_cutoff_block_idx is not None
        if enable_after_last_title_cutoff is None
        else enable_after_last_title_cutoff,
        enable_reference_zone_skip=should_apply_reference_zone_skip(mode)
        and sci_cutoff_page_idx is not None
        and sci_cutoff_block_idx is not None
        if enable_reference_zone_skip is None
        else enable_reference_zone_skip,
        enable_narrow_body_noise_skip=should_apply_narrow_body_noise_skip(mode)
        if enable_narrow_body_noise_skip is None
        else enable_narrow_body_noise_skip,
        enable_metadata_fragment_skip=should_apply_metadata_fragment_skip(mode)
        if enable_metadata_fragment_skip is None
        else enable_metadata_fragment_skip,
        metadata_fragment_max_page_idx=1 if metadata_fragment_max_page_idx is None else metadata_fragment_max_page_idx,
        enable_candidate_continuation_review=should_apply_candidate_continuation_review()
        if enable_candidate_continuation_review is None
        else enable_candidate_continuation_review,
        enable_domain_inference=(mode == "sci")
        if enable_domain_inference is None
        else enable_domain_inference,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        domain_context=domain_context or {},
        rule_profile_name=rule_profile.profile_name,
        rule_profile_text=rule_profile.profile_text,
        custom_rules_text=rule_profile.custom_rules_text,
    )


def build_book_translation_policy_config(
    *,
    data: dict,
    mode: str,
    skip_title_translation: bool,
    source_pdf_path: Path | None,
    api_key: str,
    model: str,
    base_url: str,
    output_dir: Path,
    rule_profile_name: str = DEFAULT_RULE_PROFILE_NAME,
    custom_rules_text: str = "",
    enable_domain_inference: bool | None = None,
) -> TranslationPolicyConfig:
    sci_cutoff_page_idx = None
    sci_cutoff_block_idx = None
    sci_cutoff_page_idx, sci_cutoff_block_idx = resolve_reference_cutoff(data)

    domain_context: dict[str, str] = {}
    infer_domain = should_infer_domain_context(mode, source_pdf_path) if enable_domain_inference is None else enable_domain_inference
    if infer_domain and source_pdf_path is not None:
        from translation.llm.domain_context import infer_domain_context

        preview_text = extract_ocr_preview_text(data, max_pages=2)
        try:
            domain_context = infer_domain_context(
                source_pdf_path=source_pdf_path,
                api_key=api_key,
                model=model,
                base_url=base_url,
                preview_text_fallback=preview_text,
                output_dir=output_dir,
            )
        except Exception as exc:
            print(f"sci domain inference skipped: {type(exc).__name__}: {exc}", flush=True)
            domain_context = {
                "domain": "",
                "summary": "",
                "translation_guidance": "",
                "preview_text": preview_text,
            }

    return build_translation_policy_config(
        mode=mode,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        domain_context=domain_context,
        rule_profile_name=rule_profile_name,
        custom_rules_text=custom_rules_text,
        enable_domain_inference=infer_domain,
    )


__all__ = [
    "TranslationPolicyConfig",
    "build_book_translation_policy_config",
    "build_translation_policy_config",
    "extract_ocr_preview_text",
    "resolve_reference_cutoff",
    "should_apply_after_last_title_cutoff",
    "should_apply_candidate_continuation_review",
    "should_apply_metadata_fragment_skip",
    "should_apply_narrow_body_noise_skip",
    "should_apply_reference_zone_skip",
    "should_infer_domain_context",
    "should_skip_title_translation",
]
