from __future__ import annotations

from services.rendering.layout.payload import body_fit_policy
from services.rendering.layout.payload import body_font_policy
from services.rendering.layout.payload import body_leading_policy
from services.rendering.layout.payload import body_smoothing_policy


def tighten_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del ordered_payloads, page_text_width_med
    body_font_policy.tighten_body_payloads(
        body_payloads,
        body_font_median=body_font_median,
        body_density_target=body_density_target,
        body_pressure_median=body_pressure_median,
    )


def mark_force_fit_dense_outliers(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median, ordered_payloads, page_text_width_med
    body_font_policy.mark_force_fit_dense_outliers(body_payloads)


def grow_underfilled_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_density_target, body_pressure_median, ordered_payloads
    body_font_policy.grow_underfilled_body_payloads(
        body_payloads,
        body_font_median=body_font_median,
        page_text_width_med=page_text_width_med,
    )


def recover_underfilled_body_density(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median, ordered_payloads, page_text_width_med
    body_font_policy.recover_underfilled_body_density(body_payloads)


def restore_comfort_body_leading(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median, ordered_payloads, page_text_width_med
    body_leading_policy.restore_comfort_body_leading(body_payloads)


def refit_body_leading_after_font_unify(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median, ordered_payloads, page_text_width_med
    body_leading_policy.refit_body_leading_after_font_unify(body_payloads)


def harmonize_underfilled_body_fonts(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median
    body_font_policy.harmonize_underfilled_body_fonts(
        body_payloads,
        ordered_payloads,
        page_text_width_med=page_text_width_med,
    )


def apply_page_body_font_anchor(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median
    body_font_policy.apply_page_body_font_anchor(
        body_payloads,
        ordered_payloads,
        page_text_width_med=page_text_width_med,
    )


def inherit_short_body_fonts(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median
    body_font_policy.inherit_short_body_fonts(body_payloads, ordered_payloads, page_text_width_med=page_text_width_med)


def inherit_low_height_body_fonts(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median
    body_font_policy.inherit_low_height_body_fonts(
        body_payloads,
        ordered_payloads,
        page_text_width_med=page_text_width_med,
    )


def unify_similar_body_fonts(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
    book_body_font_target: float | None = None,
) -> None:
    del body_font_median, body_density_target, body_pressure_median
    body_font_policy.unify_similar_body_fonts(
        body_payloads,
        ordered_payloads,
        page_text_width_med=page_text_width_med,
        book_body_font_target=book_body_font_target,
    )


def relax_short_body_context_heights(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median
    body_fit_policy.relax_short_body_context_heights(body_payloads, ordered_payloads, page_text_width_med=page_text_width_med)


def harmonize_long_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median, ordered_payloads
    body_font_policy.harmonize_long_body_payloads(body_payloads, page_text_width_med=page_text_width_med)


def smooth_adjacent_body_payloads(
    body_payloads: list[dict],
    *,
    body_font_median: float,
    body_density_target: float,
    body_pressure_median: float,
    ordered_payloads: list[dict],
    page_text_width_med: float,
) -> None:
    del body_font_median, body_density_target, body_pressure_median, ordered_payloads
    body_smoothing_policy.smooth_adjacent_body_payloads(body_payloads, page_text_width_med=page_text_width_med)
