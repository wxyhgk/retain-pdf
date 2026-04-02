from __future__ import annotations

from services.document_schema.provider_adapters.paddle.asset_links import enrich_asset_links
from services.document_schema.provider_adapters.paddle.content_profile import enrich_content_profile
from services.document_schema.provider_adapters.paddle.markdown_match import enrich_markdown_match
from services.document_schema.provider_adapters.paddle.markdown_match import to_plain_text


def enrich_rich_content_trace(
    *,
    metadata: dict,
    raw_label: str,
    text: str,
    markdown_images: dict[str, str],
    markdown_text: str,
) -> dict:
    enrich_content_profile(metadata=metadata, raw_label=raw_label, text=text)
    enrich_asset_links(metadata=metadata, text=text, markdown_images=markdown_images)
    enrich_markdown_match(metadata=metadata, text=text, markdown_text=markdown_text)
    return metadata


__all__ = [
    "enrich_rich_content_trace",
    "to_plain_text",
]
