from __future__ import annotations


def map_block_kind(raw_label: str, *, text: str = "") -> tuple[str, str, list[str], dict]:
    label = raw_label.strip().lower()
    if label == "doc_title":
        return "text", "title", ["title"], {}
    if label == "abstract":
        return "text", "abstract", ["abstract"], {}
    if label == "text":
        return "text", "body", [], {}
    if label == "paragraph_title":
        return "text", "heading", ["heading"], {}
    if label == "reference_content":
        return "text", "reference_entry", ["reference_entry", "reference_zone", "skip_translation"], {}
    if label == "formula_number":
        return "text", "formula_number", ["formula_number", "skip_translation"], {}
    if label == "header":
        return "text", "header", ["skip_translation"], {}
    if label == "footer":
        return "text", "footer", ["skip_translation"], {}
    if label == "footnote":
        return "text", "footnote", ["footnote", "skip_translation"], {}
    if label == "aside_text":
        return "text", "metadata", ["metadata", "skip_translation"], {}
    if label == "number":
        return "text", "page_number", ["skip_translation"], {}
    if label == "figure_title":
        lowered = text.lower()
        if "table" in lowered:
            return "text", "table_caption", ["caption", "table_caption"], {"caption_target": "table"}
        if "figure" in lowered or "listing" in lowered:
            return "text", "image_caption", ["caption", "image_caption"], {"caption_target": "image"}
        return "text", "caption", ["caption"], {"caption_target": "unknown"}
    if label == "table":
        return "table", "table_html", ["table"], {}
    if label in {"chart", "header_image", "footer_image"}:
        return "image", "image_body", ["image", "skip_translation"], {}
    if label == "image":
        return "image", "image_body", ["image", "skip_translation"], {}
    if label == "algorithm":
        return "code", "code_block", ["code"], {}
    if label in {"display_formula", "formula"}:
        return "formula", "display_formula", ["formula"], {}
    if label == "vision_footnote":
        return "text", "footnote", ["footnote"], {"footnote_target": "unknown"}
    return "unknown", "", ["unknown"], {}
