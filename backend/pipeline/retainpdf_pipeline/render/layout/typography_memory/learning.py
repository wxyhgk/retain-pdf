from __future__ import annotations

from retainpdf_pipeline.render.layout.typography_memory.store import typography_memory


def observe_payload_typography(payloads: list[dict]) -> None:
    for payload in payloads:
        key = str(payload.get("_typography_memory_key") or "")
        if not key:
            continue
        typography_memory.observe(
            feature_key=key,
            font_size_pt=float(payload.get("font_size_pt") or 0.0),
            leading_em=float(payload.get("leading_em") or 0.0),
        )


__all__ = ["observe_payload_typography"]
