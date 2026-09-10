from __future__ import annotations
import json
import re
from pathlib import Path

from retainpdf_pipeline.translate.core.continuation_hints import normalize_block_continuation_hint
from retainpdf_pipeline.translate.core.legacy_compat import is_legacy_algorithm
from retainpdf_pipeline.translate.core.legacy_compat import legacy_tags
from retainpdf_pipeline.translate.core.ocr.models import TextItem
from retainpdf_pipeline.translate.core.ocr.normalized_reader import (
    block_asset_id as _block_asset_id,
    block_bbox as _block_bbox,
    block_children as _block_children,
    block_class as _block_class,
    block_kind as _block_kind,
    block_layout_role as _block_layout_role,
    block_line_texts as _block_line_texts,
    block_policy_translate as _block_policy_translate,
    block_reading_order as _block_reading_order,
    block_semantic_role as _block_semantic_role,
    block_structure_role as _block_structure_role,
    block_sub_type as _block_sub_type,
    block_text_flow as _block_text_flow,
    block_toc_entries as _block_toc_entries,
    raw_block_type as _raw_block_type,
    ensure_normalized_document,
    get_pages as _get_pages,
    iter_page_blocks as _iter_page_blocks,
    is_normalized_document,
)
def load_ocr_json(json_path: Path) -> dict:
    """Read the ``document.v1.json`` file produced by the ocr stage.

    Stage boundary note: translate no longer adapts provider payloads or
    validates through the ocr package. Non-normalized inputs are rejected;
    run the ocr stage first to produce ``document.v1.json``.
    """

    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not is_normalized_document(data):
        schema = data.get("schema", "") if isinstance(data, dict) else ""
        raise RuntimeError(
            "translate expects normalized document.v1.json "
            f"(schema 'normalized_document_v1'); got schema={schema!r}: {json_path}. "
            "If this is a raw provider payload, run the ocr/normalize stage first "
            "to produce document.v1.json, then retry translate."
        )
    return ensure_normalized_document(data)


def get_pages(data: dict) -> list[dict]:
    normalized = ensure_normalized_document(data)
    return _get_pages(normalized)


def get_page_count(data: dict) -> int:
    return len(get_pages(data))


_MATH_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
ROLE_BODY = "body"
ROLE_INDEX_ENTRY = "index_entry"
ROLE_OPTION_HEADER = "option_header"
ROLE_OPTION_DESCRIPTION = "option_description"
ROLE_EXAMPLE_INTRO = "example_intro"
ROLE_EXAMPLE_LINE = "example_line"
ROLE_ABSTRACT = "abstract"
ROLE_REFERENCE_ENTRY = "reference_entry"
ROLE_DOCUMENT_TITLE = "document_title"
ROLE_TITLE = "title"
ROLE_HEADING = "heading"
ROLE_CAPTION = "caption"
ROLE_FIGURE_CAPTION = "figure_caption"
ROLE_IMAGE_CAPTION = "image_caption"
ROLE_TABLE_CAPTION = "table_caption"
ROLE_CODE_CAPTION = "code_caption"
ROLE_FOOTNOTE = "footnote"
ROLE_IMAGE_FOOTNOTE = "image_footnote"
ROLE_TABLE_FOOTNOTE = "table_footnote"
ROLE_TABLE_OF_CONTENTS = "table_of_contents"
PRIMARY_TRANSLATABLE_STRUCTURE_ROLES = {
    ROLE_BODY,
    ROLE_ABSTRACT,
    ROLE_DOCUMENT_TITLE,
    ROLE_TITLE,
    ROLE_HEADING,
    ROLE_CAPTION,
    ROLE_FIGURE_CAPTION,
    ROLE_FOOTNOTE,
    ROLE_IMAGE_FOOTNOTE,
    ROLE_TABLE_FOOTNOTE,
    ROLE_OPTION_HEADER,
    ROLE_OPTION_DESCRIPTION,
    ROLE_EXAMPLE_INTRO,
    ROLE_EXAMPLE_LINE,
    ROLE_TABLE_OF_CONTENTS,
}
DERIVED_STRUCTURE_ROLE_MAP = {
    "title": ROLE_TITLE,
    "heading": ROLE_HEADING,
    "caption": ROLE_CAPTION,
    "figure_caption": ROLE_FIGURE_CAPTION,
    "image_caption": ROLE_IMAGE_CAPTION,
    "table_caption": ROLE_TABLE_CAPTION,
    "code_caption": ROLE_CODE_CAPTION,
    "footnote": ROLE_FOOTNOTE,
    "image_footnote": ROLE_IMAGE_FOOTNOTE,
    "table_footnote": ROLE_TABLE_FOOTNOTE,
    "abstract": ROLE_ABSTRACT,
    "reference_entry": ROLE_REFERENCE_ENTRY,
    "table_of_contents": ROLE_TABLE_OF_CONTENTS,
}
_TRANSLATION_METADATA_BRIDGE_KEYS = {
    "continuation_hint",
    "cross_column_merge_suspected",
    "provider_cross_column_merge_suspected",
    "reading_order_unreliable",
    "provider_reading_order_unreliable",
    "structure_unreliable",
    "provider_structure_unreliable",
    "text_missing_but_bbox_present",
    "provider_text_missing_but_bbox_present",
    "peer_block_absorbed_text",
    "provider_peer_block_absorbed_text",
    "body_repair_applied",
    "provider_body_repair_applied",
    "body_repair_role",
    "provider_body_repair_role",
    "body_repair_strategy",
    "provider_body_repair_strategy",
    "body_repair_peer_block_id",
    "provider_suspected_peer_block_id",
    "continuation_suppressed",
    "provider_continuation_suppressed",
    "continuation_suppressed_reason",
    "provider_continuation_suppressed_reason",
    "column_layout_mode",
    "provider_column_layout_mode",
    "column_index_guess",
    "provider_column_index_guess",
}


def _get_structure_role(item: TextItem) -> str:
    explicit = str(getattr(item, "structure_role", "") or "").strip().lower()
    if explicit:
        return explicit
    return ""


def _set_structure_role(item: TextItem, role: str) -> None:
    item.structure_role = role


def _translation_metadata_bridge(block: dict) -> dict:
    metadata = dict(block.get("metadata", {}) or {})
    bridged = {
        key: value
        for key, value in metadata.items()
        if key in _TRANSLATION_METADATA_BRIDGE_KEYS
    }
    bridged["continuation_hint"] = normalize_block_continuation_hint(block.get("continuation_hint"))
    return bridged


def _repair_math_control_chars(text: str, next_text: str = "") -> str:
    if not text or not _MATH_CONTROL_CHAR_RE.search(text):
        return text

    chars = list(text)
    for match in list(_MATH_CONTROL_CHAR_RE.finditer(text)):
        start, end = match.span()
        before = text[max(0, start - 48) : start].lower()
        after = (text[end : min(len(text), end + 48)] + " " + next_text[:48]).lower()
        if (
            re.search(r"(fixing|rotation angle|torsion angle|dihedral angle|angle|angles|function of)\s*$", before)
            or re.search(r"^\s*(as a dihedral angle|of the methyl group|varying|represents|=|and|or|\))", after)
        ):
            chars[start] = r"\theta"
        else:
            chars[start] = " "
    return "".join(chars)


def normalize_text(raw_text: str) -> str:
    return " ".join(_repair_math_control_chars(raw_text).split())


def normalize_source_text(raw_text: str) -> str:
    text = _repair_math_control_chars(raw_text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) >= 2:
        return "\n".join(" ".join(line.split()) for line in lines)
    return " ".join(text.split())


def normalize_span_text(raw_text: str, next_text: str = "") -> str:
    return " ".join(_repair_math_control_chars(raw_text, next_text=next_text).split())


def iter_block_lines(block: dict):
    yield from block.get("lines", [])


def block_segments(block: dict) -> list[dict]:
    segments: list[dict] = []
    for line in iter_block_lines(block):
        spans = line.get("spans", []) or line.get("segments", [])
        for index, span in enumerate(spans):
            content = span.get("content", span.get("text", ""))
            if not content or not content.strip():
                continue
            next_content = (
                spans[index + 1].get("content", spans[index + 1].get("text", ""))
                if index + 1 < len(spans)
                else ""
            )
            span_type = span.get("type", span.get("raw_type", "text"))
            segments.append(
                {
                    "type": (
                        "inline_equation"
                        if span_type in {"formula", "inline_formula"}
                        else span_type
                    ),
                    "content": normalize_span_text(content, next_content),
                }
            )
    return segments


def block_lines(block: dict) -> list[dict]:
    lines_out: list[dict] = []
    for line in iter_block_lines(block):
        spans_out = []
        spans = line.get("spans", []) or line.get("segments", [])
        for index, span in enumerate(spans):
            content = span.get("content", span.get("text", ""))
            if not content or not content.strip():
                continue
            next_content = (
                spans[index + 1].get("content", spans[index + 1].get("text", ""))
                if index + 1 < len(spans)
                else ""
            )
            span_type = span.get("type", span.get("raw_type", "text"))
            spans_out.append(
                {
                    "type": (
                        "inline_equation"
                        if span_type in {"formula", "inline_formula"}
                        else span_type
                    ),
                    "content": normalize_span_text(content, next_content),
                    "bbox": span.get("bbox", []),
                }
            )
        if spans_out:
            lines_out.append(
                {
                    "bbox": line.get("bbox", []),
                    "spans": spans_out,
                }
            )
    return lines_out


def merge_segments_text(segments: list[dict]) -> str:
    return normalize_text(" ".join(segment["content"] for segment in segments if segment["content"]))


def block_source_text(block: dict, segments: list[dict]) -> str:
    content_text = str(((block.get("content") or {}).get("text")) or block.get("text") or "")
    if content_text.strip():
        return normalize_source_text(content_text)
    return merge_segments_text(segments)


def _bbox_left(item: TextItem) -> float:
    return item.bbox[0] if len(item.bbox) == 4 else 0.0


def _bbox_top(item: TextItem) -> float:
    return item.bbox[1] if len(item.bbox) == 4 else 0.0


def _bbox_bottom(item: TextItem) -> float:
    return item.bbox[3] if len(item.bbox) == 4 else 0.0


def _bbox_width(item: TextItem) -> float:
    return item.bbox[2] - item.bbox[0] if len(item.bbox) == 4 else 0.0


def _gap_y(prev_item: TextItem, next_item: TextItem) -> float:
    return _bbox_top(next_item) - _bbox_bottom(prev_item)


def _single_line(item: TextItem) -> bool:
    return len(item.lines) <= 1


def _text_len(item: TextItem) -> int:
    return len(re.sub(r"\s+", "", item.text))


def _leading_symbol(item: TextItem) -> str:
    stripped = item.text.strip()
    if not stripped:
        return ""
    return stripped[0]


def _looks_like_index_entry(item: TextItem) -> bool:
    text = item.text.strip()
    if not text or not _single_line(item):
        return False
    if len(text) > 48:
        return False
    return _leading_symbol(item) in {"♢", "•", "▪", "◦"}


def _looks_like_option_header(item: TextItem) -> bool:
    text = item.text.strip()
    if not text or not _single_line(item):
        return False
    if len(text) > 80:
        return False
    if text.startswith(("%", "#", "\\")):
        return True
    if re.fullmatch(r"[A-Za-z][\w.-]*\s*=\s*[\w<>{},.-]+", text):
        return True
    return False


def _looks_like_explanatory_paragraph(item: TextItem) -> bool:
    text = item.text.strip()
    words = re.findall(r"[A-Za-z]{3,}", text)
    return len(words) >= 8 and len(item.lines) >= 1


def _looks_like_example_intro(item: TextItem) -> bool:
    text = item.text.strip()
    if len(text) > 260:
        return False
    return text.endswith(":") and bool(re.search(r"(input|example|following|via|look like this|as follows|by)\s*:\s*$", text, re.I))


def _looks_like_structured_example_line(item: TextItem) -> bool:
    text = item.text.strip()
    if not text or len(text) > 96:
        return False
    if re.fullmatch(r"[A-Z][a-z]?\s+-?\d+\.\d+\s+-?\d+\.\d+\s+-?\d+\.\d+", text):
        return True
    if re.fullmatch(r"\d+\s+\d+\s+[A-Za-z]+", text):
        return True
    if re.fullmatch(r"[A-Za-z][\w.-]*\s+<[^<>\n]+>", text):
        return True
    if re.fullmatch(r"[A-Za-z][\w.-]*(?:\s+-[\w-]+(?:\s+\S+)*)+", text):
        return True
    if re.fullmatch(r"[A-Z][A-Z_ ]+\s*=\s*[\w.+-]+", text):
        return True
    return False


def _apply_page_structure(items: list[TextItem]) -> list[TextItem]:
    for item in items:
        existing_role = _get_structure_role(item)
        item.structure_role = existing_role or ROLE_BODY
        item.metadata = {
            **(item.metadata or {}),
            "structure_role": item.structure_role,
            "structure_group": "",
            "pair_with": "",
        }

    group_counter = 0

    def new_group(prefix: str) -> str:
        nonlocal group_counter
        group_counter += 1
        return f"{prefix}-{group_counter:03d}"

    i = 0
    while i < len(items):
        item = items[i]
        if _looks_like_index_entry(item):
            symbol = _leading_symbol(item)
            run = [item]
            j = i + 1
            while j < len(items):
                nxt = items[j]
                if (
                    _looks_like_index_entry(nxt)
                    and _leading_symbol(nxt) == symbol
                    and abs(_bbox_left(nxt) - _bbox_left(item)) <= 20
                    and _gap_y(items[j - 1], nxt) <= 18
                ):
                    run.append(nxt)
                    j += 1
                    continue
                break
            if len(run) >= 6:
                group_id = new_group("index")
                for entry in run:
                    _set_structure_role(entry, ROLE_INDEX_ENTRY)
                    entry.metadata["structure_group"] = group_id
                i = j
                continue
        i += 1

    for idx in range(len(items) - 1):
        item = items[idx]
        nxt = items[idx + 1]
        if _get_structure_role(item) != ROLE_BODY or _get_structure_role(nxt) != ROLE_BODY:
            continue
        if (
            _looks_like_option_header(item)
            and _looks_like_explanatory_paragraph(nxt)
            and abs(_bbox_left(item) - _bbox_left(nxt)) <= 30
            and _gap_y(item, nxt) <= 24
        ):
            group_id = new_group("option")
            _set_structure_role(item, ROLE_OPTION_HEADER)
            item.metadata["structure_group"] = group_id
            item.metadata["pair_with"] = nxt.item_id
            _set_structure_role(nxt, ROLE_OPTION_DESCRIPTION)
            nxt.metadata["structure_group"] = group_id
            nxt.metadata["pair_with"] = item.item_id

    for idx, item in enumerate(items):
        if _get_structure_role(item) != ROLE_BODY:
            continue
        if not _looks_like_example_intro(item):
            continue
        run: list[TextItem] = []
        j = idx + 1
        while j < len(items):
            nxt = items[j]
            if _get_structure_role(nxt) != ROLE_BODY:
                break
            if _looks_like_structured_example_line(nxt) or (_single_line(nxt) and _text_len(nxt) <= 36 and _gap_y(items[j - 1], nxt) <= 20):
                run.append(nxt)
                j += 1
                continue
            break
        if len(run) >= 2:
            group_id = new_group("example")
            _set_structure_role(item, ROLE_EXAMPLE_INTRO)
            item.metadata["structure_group"] = group_id
            for entry in run:
                _set_structure_role(entry, ROLE_EXAMPLE_LINE)
                entry.metadata["structure_group"] = group_id

    return items


def _is_translatable_page_item(item: TextItem) -> bool:
    return _get_structure_role(item) in PRIMARY_TRANSLATABLE_STRUCTURE_ROLES


PRIMARY_TRANSLATABLE_SEMANTIC_ROLES = {"body", "abstract", "table_of_contents"}
PRIMARY_TRANSLATABLE_STRUCTURE_HINTS = {"body", "table_of_contents"}
KEEP_ORIGIN_BLOCK_CLASSES = {"formula"}
PRIMARY_TRANSLATABLE_BLOCK_CLASSES = {"body", "title", "caption", "footnote"}


def _is_algorithm_container(block: dict) -> bool:
    explicit_class = str(block.get("block_class", "") or "").strip().lower()
    semantic_role = _block_semantic_role(block)
    structure_role = _block_structure_role(block)
    if semantic_role == "algorithm" or structure_role in {"algorithm", "code_block"}:
        return True
    if explicit_class not in {"", "unknown"}:
        return explicit_class == "code"
    if any(
        str(value or "").strip().lower() not in {"", "unknown"}
        for value in (_block_layout_role(block), semantic_role, structure_role)
    ):
        return False
    if _block_class(block) == "code":
        return True
    # Old normalized documents did not carry a canonical code kind/class.
    return is_legacy_algorithm(block)


def _is_keep_origin_render_block(block: dict) -> bool:
    if _block_class(block) not in KEEP_ORIGIN_BLOCK_CLASSES:
        return False
    if _block_policy_translate(block) is not None:
        return True
    return "skip_translation" not in legacy_tags(block)


def _is_primary_translatable_text_block(block: dict, data: dict) -> bool:
    explicit_policy = _block_policy_translate(block)
    if explicit_policy is not None:
        return explicit_policy
    del data
    if _block_kind(block) != "text":
        return False
    if _block_class(block) not in PRIMARY_TRANSLATABLE_BLOCK_CLASSES:
        return False
    layout_role = _block_layout_role(block)
    semantic_role = _block_semantic_role(block)
    structure_role = _block_structure_role(block)
    if semantic_role == "abstract":
        return True
    if semantic_role == "table_of_contents" or structure_role == "table_of_contents":
        return True
    if semantic_role not in PRIMARY_TRANSLATABLE_SEMANTIC_ROLES:
        return False
    if structure_role not in PRIMARY_TRANSLATABLE_STRUCTURE_HINTS:
        return False
    return layout_role in {"paragraph", "unknown", ""}


def should_translate_block(
    block: dict,
    data: dict,
    text: str,
    *,
    inside_algorithm: bool = False,
    page_blocks: list[dict] | None = None,
    current_block_idx: int = -1,
) -> bool:
    explicit_policy = _block_policy_translate(block)
    del text, page_blocks, current_block_idx
    if explicit_policy is not None:
        if not explicit_policy:
            return False
        if inside_algorithm or _is_algorithm_container(block):
            return False
        return True
    if inside_algorithm or _is_algorithm_container(block):
        return False
    if "skip_translation" in legacy_tags(block):
        return False
    if _block_kind(block) != "text":
        return False
    return _is_primary_translatable_text_block(block, data)


def extract_block_item(
    block: dict,
    data: dict,
    page_idx: int,
    block_idx: int,
    item_suffix: str = "",
    inside_algorithm: bool = False,
    page_blocks: list[dict] | None = None,
) -> TextItem | None:
    segments = block_segments(block)
    lines = block_lines(block)
    text = block_source_text(block, segments)
    if not text:
        return None
    if not should_translate_block(
        block,
        data,
        text,
        inside_algorithm=inside_algorithm,
        page_blocks=page_blocks,
        current_block_idx=block_idx,
    ) and not _is_keep_origin_render_block(block):
        return None
    block_type = _block_kind(block)
    structure_role = _seed_structure_role(block)
    layout_role = _block_layout_role(block)
    semantic_role = _block_semantic_role(block)
    policy_translate = _block_policy_translate(block)
    return TextItem(
        item_id=f"p{page_idx + 1:03d}-b{block_idx:03d}{item_suffix}",
        page_idx=page_idx,
        block_idx=block_idx,
        block_type=block_type,
        bbox=_block_bbox(block),
        text=text,
        segments=segments,
        lines=lines,
        line_texts=_block_line_texts(block),
        text_flow=_block_text_flow(block) or "flow",
        toc_entries=_block_toc_entries(block),
        metadata={
            **_translation_metadata_bridge(block),
        },
        block_kind=block_type,
        block_class=_block_class(block),
        layout_role=layout_role,
        semantic_role=semantic_role,
        structure_role=structure_role,
        policy_translate=policy_translate,
        asset_id=_block_asset_id(block),
        reading_order=_block_reading_order(block),
        raw_block_type=_raw_block_type(block),
        normalized_sub_type=_block_sub_type(block),
    )


def _seed_structure_role(block: dict) -> str:
    explicit_structure_role = _block_structure_role(block)
    if explicit_structure_role:
        return explicit_structure_role
    explicit_semantic_role = _block_semantic_role(block)
    if explicit_semantic_role == "abstract":
        return ROLE_ABSTRACT
    explicit_layout_role = _block_layout_role(block)
    if explicit_layout_role == "title":
        return ROLE_TITLE
    if explicit_layout_role == "heading":
        return ROLE_HEADING
    if explicit_layout_role in {"paragraph", "list_item"}:
        return ROLE_BODY
    if explicit_layout_role == "caption":
        return ROLE_CAPTION
    return ""


def extract_text_items(data: dict, page_idx: int) -> list[TextItem]:
    pages = get_pages(data)
    if page_idx >= len(pages):
        raise IndexError(f"page_idx {page_idx} out of range; total pages={len(pages)}")

    page = pages[page_idx]
    page_blocks = list(_iter_page_blocks(data, page))
    items: list[TextItem] = []
    def visit_block(block: dict, block_idx: int, item_suffix: str = "", inside_algorithm: bool = False) -> None:
        current_inside_algorithm = inside_algorithm or _is_algorithm_container(block)
        item = extract_block_item(
            block,
            data,
            page_idx=page_idx,
            block_idx=block_idx,
            item_suffix=item_suffix,
            inside_algorithm=current_inside_algorithm,
            page_blocks=page_blocks,
        )
        if item is not None:
            items.append(item)

        for child_idx, child in enumerate(_block_children(data, block)):
            visit_block(
                child,
                block_idx=block_idx,
                item_suffix=f"{item_suffix}-i{child_idx:03d}",
                inside_algorithm=current_inside_algorithm,
            )

    for block_idx, block in enumerate(page_blocks):
        visit_block(block, block_idx)
    return [item for item in _apply_page_structure(items) if _is_translatable_page_item(item)]
