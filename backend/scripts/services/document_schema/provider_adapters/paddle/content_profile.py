from __future__ import annotations


def enrich_content_profile(*, metadata: dict, raw_label: str, text: str) -> dict:
    label = raw_label.strip().lower()
    stripped = text.strip()
    lowered = stripped.lower()

    metadata["content_is_rich"] = label in {"image", "table", "algorithm", "figure_title"}
    metadata["content_length"] = len(stripped)
    metadata["content_line_count"] = len([line for line in stripped.splitlines() if line.strip()]) if stripped else 0

    if label == "table":
        metadata["content_format"] = "html_table" if "<table" in lowered else "plain_text"
        metadata["contains_table_tag"] = "<table" in lowered
        metadata["contains_img_tag"] = "<img" in lowered
        metadata["html_length"] = len(stripped)
    elif label == "image":
        metadata["content_format"] = "html_image" if "<img" in lowered else "plain_text"
        metadata["contains_img_tag"] = "<img" in lowered
        metadata["contains_table_tag"] = "<table" in lowered
        metadata["html_length"] = len(stripped)
    elif label == "algorithm":
        metadata["content_format"] = "code_like_text"
        metadata["contains_img_tag"] = "<img" in lowered
        metadata["contains_table_tag"] = "<table" in lowered
        metadata["looks_like_command"] = "python " in lowered or "bash " in lowered or "scripts/" in stripped
    elif label == "figure_title":
        metadata["content_format"] = "html_caption" if "<div" in lowered else "plain_text"
        metadata["contains_img_tag"] = "<img" in lowered
        metadata["contains_table_tag"] = "<table" in lowered
    return metadata


__all__ = [
    "enrich_content_profile",
]
