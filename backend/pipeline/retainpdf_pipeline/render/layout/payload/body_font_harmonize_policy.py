from __future__ import annotations

from statistics import median

from retainpdf_pipeline.render.layout.payload.body_common import payload_density


def harmonize_long_body_payloads(body_payloads: list[dict], *, page_text_width_med: float) -> None:
    long_body_payloads = []
    for payload in body_payloads:
        inner_width = max(8.0, payload["inner_bbox"][2] - payload["inner_bbox"][0])
        inner_height = max(8.0, payload["inner_bbox"][3] - payload["inner_bbox"][1])
        if inner_height < 90 or inner_width < page_text_width_med * 0.72:
            continue
        if payload_density(payload) > 0.98:
            continue
        long_body_payloads.append(payload)

    if len(long_body_payloads) < 2:
        return

    long_body_font_median = median(payload["font_size_pt"] for payload in long_body_payloads)
    long_body_leading_median = median(payload["leading_em"] for payload in long_body_payloads)
    for payload in long_body_payloads:
        payload["font_size_pt"] = round(
            min(max(payload["font_size_pt"], long_body_font_median - 0.14), long_body_font_median + 0.14),
            2,
        )
        payload["leading_em"] = round(
            min(max(payload["leading_em"], long_body_leading_median - 0.05), long_body_leading_median + 0.05),
            2,
        )
