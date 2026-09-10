from __future__ import annotations

import re
from pathlib import PurePosixPath


_IMAGE_BOX_RE = re.compile(
    r"_box_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)(?:\.[^.]+)?$",
    flags=re.IGNORECASE,
)


def _asset_keys_from_bbox(markdown_images: dict[str, str], bbox: list[float]) -> list[str]:
    if len(bbox) != 4:
        return []
    target = [float(value) for value in bbox]
    exact_matches: list[str] = []
    contained_matches: list[tuple[list[float], str]] = []
    for key in markdown_images:
        name = PurePosixPath(str(key or "").replace("\\", "/")).name
        match = _IMAGE_BOX_RE.search(name)
        if not match:
            continue
        candidate = [float(value) for value in match.groups()]
        if all(abs(left - right) <= 2.0 for left, right in zip(candidate, target)):
            exact_matches.append(str(key))
            continue
        # Paddle sometimes emits one outer image block plus several cropped
        # structures/figures inside it. Keep every contained asset instead of
        # silently retaining only the outer preview. Small provider rounding
        # differences near the edge are tolerated.
        tolerance = 12.0
        if (
            candidate[0] >= target[0] - tolerance
            and candidate[1] >= target[1] - tolerance
            and candidate[2] <= target[2] + tolerance
            and candidate[3] <= target[3] + tolerance
        ):
            contained_matches.append((candidate, str(key)))
            continue
        intersection_width = max(0.0, min(candidate[2], target[2]) - max(candidate[0], target[0]))
        intersection_height = max(0.0, min(candidate[3], target[3]) - max(candidate[1], target[1]))
        candidate_area = max(0.0, candidate[2] - candidate[0]) * max(0.0, candidate[3] - candidate[1])
        center_x = (candidate[0] + candidate[2]) / 2.0
        center_y = (candidate[1] + candidate[3]) / 2.0
        overlap_ratio = (
            intersection_width * intersection_height / candidate_area
            if candidate_area > 0
            else 0.0
        )
        if (
            target[0] - tolerance <= center_x <= target[2] + tolerance
            and target[1] - tolerance <= center_y <= target[3] + tolerance
            and overlap_ratio >= 0.8
        ):
            contained_matches.append((candidate, str(key)))
    contained_matches.sort(key=lambda item: (item[0][1], item[0][0], item[1]))
    return list(dict.fromkeys([*exact_matches, *(key for _bbox, key in contained_matches)]))


def enrich_asset_links(
    *,
    metadata: dict,
    text: str,
    markdown_images: dict[str, str],
    bbox: list[float] | None = None,
) -> dict:
    stripped = text.strip()
    asset_keys: list[str] = []
    for value in re.findall(r'src=["\']([^"\']+)["\']', stripped, flags=re.IGNORECASE):
        asset_key = value.strip()
        if asset_key and asset_key not in asset_keys:
            asset_keys.append(asset_key)
    if not asset_keys:
        asset_keys.extend(_asset_keys_from_bbox(markdown_images, list(bbox or [])))
    asset_key = asset_keys[0] if asset_keys else ""
    if asset_key:
        metadata["asset_key"] = asset_key
        metadata["asset_keys"] = asset_keys
        metadata["asset_kind"] = "markdown_image"
        metadata["asset_path"] = asset_key
        metadata["asset_paths"] = asset_keys
        # Provider values are commonly expiring signed URLs. Keep only the
        # stable job-local path in normalized JSON; the downloaded file is the
        # durable source used by readers and AI tools.
        resolved_count = sum(
            1 for key in asset_keys if str(markdown_images.get(key, "") or "")
        )
        metadata["asset_resolved"] = resolved_count == len(asset_keys)
        metadata["asset_resolved_count"] = resolved_count
    else:
        metadata["asset_key"] = ""
        metadata["asset_keys"] = []
        metadata["asset_kind"] = ""
        metadata["asset_path"] = ""
        metadata["asset_paths"] = []
        metadata["asset_resolved"] = False
        metadata["asset_resolved_count"] = 0
    return metadata


__all__ = [
    "enrich_asset_links",
]
