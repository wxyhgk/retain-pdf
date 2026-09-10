from __future__ import annotations

from retainpdf_pipeline.render.layout.payload.block_seed_body_policy import relax_wide_aspect_body_leading
from retainpdf_pipeline.render.layout.payload.block_seed_metrics import collect_page_seed_metrics
from retainpdf_pipeline.render.layout.payload.block_seed_payload_factory import build_seed_payload_for_item


_relax_wide_aspect_body_leading = relax_wide_aspect_body_leading
_collect_page_seed_metrics = collect_page_seed_metrics


def build_block_payloads(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
    page_height: float | None = None,
) -> tuple[list[dict], float]:
    metrics = collect_page_seed_metrics(translated_items, page_width=page_width)
    block_payloads: list[dict] = []
    for index, item in enumerate(translated_items):
        payload = build_seed_payload_for_item(
            index=index,
            item=item,
            metrics=metrics,
            page_width=page_width,
            page_height=page_height,
        )
        if payload is not None:
            block_payloads.append(payload)
    return block_payloads, metrics.page_text_width_med
