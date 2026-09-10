from __future__ import annotations

from collections.abc import Callable
from statistics import median

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.layout.payload.body_common import resolve_body_targets
from retainpdf_pipeline.render.layout.payload import body_policy_facade as body_policy
from retainpdf_pipeline.render.layout.payload.line_structure import fit_preserved_line_block_metrics


BodyStage = Callable[..., None]
BODY_PRE_GROW_STAGES: tuple[BodyStage, ...] = (
    body_policy.tighten_body_payloads,
    body_policy.mark_force_fit_dense_outliers,
)
BODY_POST_GROW_STAGES: tuple[BodyStage, ...] = (
    body_policy.inherit_short_body_fonts,
    body_policy.inherit_low_height_body_fonts,
    body_policy.relax_short_body_context_heights,
    body_policy.grow_underfilled_body_payloads,
    body_policy.harmonize_underfilled_body_fonts,
    body_policy.recover_underfilled_body_density,
    body_policy.apply_page_body_font_anchor,
    body_policy.restore_comfort_body_leading,
    body_policy.harmonize_long_body_payloads,
    body_policy.smooth_adjacent_body_payloads,
    body_policy.refit_body_leading_after_font_unify,
)
BODY_FONT_UNIFY_STAGES: tuple[BodyStage, ...] = (
    body_policy.unify_similar_body_fonts,
)


def _refit_preserved_line_payloads(payloads: list[dict]) -> None:
    for payload in payloads:
        if not payload.get("preserve_line_breaks"):
            continue
        font_size_pt, leading_em = fit_preserved_line_block_metrics(
            payload.get("inner_bbox") or payload.get("bbox") or [],
            payload.get("translated_text") or "",
            float(payload.get("font_size_pt") or 0.0),
            float(payload.get("leading_em") or 0.0),
        )
        payload["font_size_pt"] = font_size_pt
        payload["leading_em"] = leading_em


def _run_stage(
    stage: BodyStage,
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
    book_body_font_target: float | None,
) -> None:
    kwargs = {
        "body_font_median": body_font_median,
        "body_density_target": body_density_target,
        "body_pressure_median": body_pressure_median,
        "ordered_payloads": ordered_payloads,
        "page_text_width_med": page_text_width_med,
    }
    if stage in BODY_FONT_UNIFY_STAGES:
        kwargs["book_body_font_target"] = book_body_font_target
    stage(body_payloads, **kwargs)


def apply_body_payload_pipeline(
    ordered_payloads: list[dict],
    *,
    page_text_width_med: float,
    book_body_font_target: float | None = None,
) -> None:
    body_payloads = [payload for payload in ordered_payloads if payload["is_body"]]
    if not body_payloads:
        return

    body_font_median, body_density_target, body_pressure_median = resolve_body_targets(body_payloads)
    for stage in BODY_PRE_GROW_STAGES:
        _run_stage(
            stage,
            body_payloads,
            body_font_median=body_font_median,
            body_density_target=body_density_target,
            body_pressure_median=body_pressure_median,
            ordered_payloads=ordered_payloads,
            page_text_width_med=page_text_width_med,
            book_body_font_target=book_body_font_target,
        )

    body_font_median = median(payload["font_size_pt"] for payload in body_payloads)
    stages = BODY_POST_GROW_STAGES
    if layout.FONT_UNIFY_MODE != "off":
        stages = (
            body_policy.inherit_short_body_fonts,
            *BODY_FONT_UNIFY_STAGES,
            body_policy.inherit_low_height_body_fonts,
            body_policy.relax_short_body_context_heights,
            body_policy.grow_underfilled_body_payloads,
            body_policy.harmonize_underfilled_body_fonts,
            body_policy.recover_underfilled_body_density,
            body_policy.apply_page_body_font_anchor,
            body_policy.restore_comfort_body_leading,
            body_policy.harmonize_long_body_payloads,
            body_policy.smooth_adjacent_body_payloads,
            *BODY_FONT_UNIFY_STAGES,
            body_policy.recover_underfilled_body_density,
            body_policy.refit_body_leading_after_font_unify,
        )
    for stage in stages:
        _run_stage(
            stage,
            body_payloads,
            body_font_median=body_font_median,
            body_density_target=body_density_target,
            body_pressure_median=body_pressure_median,
            ordered_payloads=ordered_payloads,
            page_text_width_med=page_text_width_med,
            book_body_font_target=book_body_font_target,
        )
    _refit_preserved_line_payloads(body_payloads)
