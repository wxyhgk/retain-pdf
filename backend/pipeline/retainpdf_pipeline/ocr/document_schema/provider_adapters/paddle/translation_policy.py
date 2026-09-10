from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PaddleTranslationPolicy:
    translate: bool
    reason: str

    def as_document_policy(self) -> dict[str, object]:
        return {
            "translate": self.translate,
            "translate_reason": self.reason,
        }


_POLICY_BY_SUBTYPE = {
    "title": PaddleTranslationPolicy(True, "provider_title_candidate"),
    "heading": PaddleTranslationPolicy(True, "provider_heading_candidate"),
    "body": PaddleTranslationPolicy(True, "provider_body_whitelist:body"),
    "table_of_contents": PaddleTranslationPolicy(
        True,
        "provider_toc_whitelist:content",
    ),
    "figure_caption": PaddleTranslationPolicy(
        True,
        "provider_caption_whitelist:figure_caption",
    ),
    "table_caption": PaddleTranslationPolicy(
        True,
        "provider_caption_whitelist:table_caption",
    ),
    "image_footnote": PaddleTranslationPolicy(
        True,
        "provider_footnote_whitelist:image_footnote",
    ),
    "table_footnote": PaddleTranslationPolicy(
        True,
        "provider_footnote_whitelist:table_footnote",
    ),
}

_POLICY_BY_RAW_LABEL = {
    "abstract": PaddleTranslationPolicy(True, "provider_body_whitelist:abstract"),
    "footnote": PaddleTranslationPolicy(False, "provider_non_body:footnote"),
}

_VISION_FOOTNOTE_FALLBACK = PaddleTranslationPolicy(
    True,
    "provider_footnote_whitelist:vision_footnote",
)


def derive_paddle_translation_policy(
    *,
    raw_label: str,
    block_type: str,
    sub_type: str,
) -> PaddleTranslationPolicy:
    if block_type != "text":
        return PaddleTranslationPolicy(
            False,
            f"provider_non_text:{block_type or 'unknown'}",
        )

    label = str(raw_label or "").strip().lower()
    if label == "vision_footnote" and sub_type == "footnote":
        return _VISION_FOOTNOTE_FALLBACK
    if label in _POLICY_BY_RAW_LABEL:
        return _POLICY_BY_RAW_LABEL[label]
    if sub_type in _POLICY_BY_SUBTYPE:
        return _POLICY_BY_SUBTYPE[sub_type]
    return PaddleTranslationPolicy(
        False,
        f"provider_non_body:{sub_type or label or 'unknown'}",
    )


__all__ = [
    "PaddleTranslationPolicy",
    "derive_paddle_translation_policy",
]
