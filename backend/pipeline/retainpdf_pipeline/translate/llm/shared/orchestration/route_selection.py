from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.translate.llm.placeholder_transform import has_formula_placeholders
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.common import should_prefer_tagged_placeholder_first
from retainpdf_pipeline.translate.llm.shared.orchestration.heavy_formula import heavy_formula_split_reason
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_routing import formula_segment_translation_route
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode


@dataclass(frozen=True)
class SingleItemRoute:
    direct_typst: bool
    heavy_formula_split_reason: str
    formula_segment_route: str
    prefer_tagged_placeholder_first: bool


def select_single_item_route(item: dict, *, context: TranslationControlContext) -> SingleItemRoute:
    if is_direct_math_mode(item):
        return SingleItemRoute(
            direct_typst=True,
            heavy_formula_split_reason="",
            formula_segment_route="none",
            prefer_tagged_placeholder_first=False,
        )
    split_reason = ""
    heavy_formula_split_applied = bool(item.get("_heavy_formula_split_applied"))
    if not heavy_formula_split_applied:
        split_reason = heavy_formula_split_reason(item, context=context)
    return SingleItemRoute(
        direct_typst=is_direct_math_mode(item),
        heavy_formula_split_reason=split_reason,
        formula_segment_route=formula_segment_translation_route(item, policy=context.segmentation_policy),
        prefer_tagged_placeholder_first=(
            not heavy_formula_split_applied
            and
            has_formula_placeholders(item)
            and should_prefer_tagged_placeholder_first(
                item,
                allow_tagged_placeholder_retry=context.fallback_policy.allow_tagged_placeholder_retry,
            )
        ),
    )


__all__ = [
    "SingleItemRoute",
    "select_single_item_route",
]
