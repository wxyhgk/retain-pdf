from __future__ import annotations

import re


def enrich_asset_links(*, metadata: dict, text: str, markdown_images: dict[str, str]) -> dict:
    stripped = text.strip()
    image_match = re.search(r'src=["\']([^"\']+)["\']', stripped, flags=re.IGNORECASE)
    if image_match:
        asset_key = image_match.group(1).strip()
        metadata["asset_key"] = asset_key
        metadata["asset_kind"] = "markdown_image"
        metadata["asset_url"] = str(markdown_images.get(asset_key, "") or "")
        metadata["asset_resolved"] = bool(metadata["asset_url"])
    else:
        metadata["asset_key"] = ""
        metadata["asset_kind"] = ""
        metadata["asset_url"] = ""
        metadata["asset_resolved"] = False
    return metadata


__all__ = [
    "enrich_asset_links",
]
