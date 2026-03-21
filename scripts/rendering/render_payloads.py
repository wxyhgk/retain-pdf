import re
from copy import deepcopy
from statistics import median

from common.config import DEFAULT_FONT_SIZE
from rendering.font_fit import bbox_width
from rendering.font_fit import estimate_font_size_pt
from rendering.font_fit import estimate_leading_em
from rendering.font_fit import inner_bbox
from rendering.font_fit import is_body_text_candidate
from rendering.font_fit import is_default_text_block
from rendering.font_fit import page_baseline_font_size
from rendering.math_utils import build_markdown_from_parts
from rendering.math_utils import build_markdown_paragraph
from rendering.math_utils import build_plain_text_from_text
from rendering.math_utils import build_plain_text
from rendering.models import RenderBlock


TOKEN_RE = re.compile(r"(\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|[\u4e00-\u9fff]|.)")


def _is_flag_like_plain_text_block(item: dict) -> bool:
    text = build_plain_text(item)
    if not text:
        return False
    if len(item.get("formula_map", [])) > 0:
        return False
    line_count = len(item.get("lines", []))
    if line_count > 2:
        return False
    if not text.startswith("-"):
        return False
    if len(text) > 64:
        return False
    return True


def _block_metrics(item: dict, page_font_size: float, page_line_pitch: float, page_line_height: float, density_baseline: float, page_text_width_med: float) -> tuple[float, float]:
    item = dict(item)
    item["_is_body_text_candidate"] = is_body_text_candidate(item, page_text_width_med)
    font_size_pt = estimate_font_size_pt(
        item,
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
    )
    if is_default_text_block(item):
        font_size_pt = DEFAULT_FONT_SIZE
    leading_em = estimate_leading_em(item, page_line_pitch, font_size_pt)
    return font_size_pt, leading_em


def _tokenize_protected_text(text: str) -> list[str]:
    return TOKEN_RE.findall(text or "")


def _token_units(token: str, formula_lookup: dict[str, str]) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return max(0.2, len(token) * 0.25)
    if token.startswith("[[FORMULA_"):
        formula_text = formula_lookup.get(token, token)
        normalized = re.sub(r"\s+", "", formula_text)
        return max(1.5, len(normalized) * 0.48)
    if re.fullmatch(r"[\u4e00-\u9fff]", token):
        return 1.0
    if re.fullmatch(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", token):
        return max(1.0, len(token) * 0.55)
    return 0.45


def _box_capacity_units(inner: list[float], font_size_pt: float, leading_em: float) -> float:
    if len(inner) != 4:
        return 0.0
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    lines = max(1, int(height / line_step))
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    return lines * chars_per_line * 0.98


def _trim_joined_tokens(tokens: list[str]) -> str:
    return "".join(tokens).strip()


def _split_protected_text_for_boxes(protected_text: str, formula_map: list[dict], capacities: list[float]) -> list[str]:
    if len(capacities) <= 1:
        return [protected_text.strip()]
    tokens = _tokenize_protected_text(protected_text)
    if not tokens:
        return [""] * len(capacities)
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    token_costs = [_token_units(token, formula_lookup) for token in tokens]
    remaining_cost = sum(token_costs)
    if remaining_cost <= 0:
        return [_trim_joined_tokens(tokens)] + [""] * (len(capacities) - 1)

    chunks: list[str] = []
    cursor = 0
    total_capacity = sum(max(1.0, capacity) for capacity in capacities)

    for box_index, capacity in enumerate(capacities):
        if box_index == len(capacities) - 1:
            chunks.append(_trim_joined_tokens(tokens[cursor:]))
            break

        share = max(1.0, capacity) / max(1.0, total_capacity)
        target_cost = remaining_cost * share
        running_cost = 0.0
        end = cursor
        best_end = cursor
        while end < len(tokens):
            running_cost += token_costs[end]
            end += 1
            if running_cost >= target_cost:
                best_end = end
                lookahead = min(len(tokens), end + 12)
                probe = end
                while probe < lookahead:
                    probe += 1
                    candidate = _trim_joined_tokens(tokens[cursor:probe])
                    if candidate.endswith((".", "。", "!", "！", "?", "？", ";", "；", ":", "：", ",", "，")):
                        best_end = probe
                        break
                break
        if best_end == cursor:
            best_end = min(len(tokens), max(cursor + 1, end))

        remaining_boxes = len(capacities) - box_index - 1
        if len(tokens) - best_end < remaining_boxes:
            best_end = max(cursor + 1, len(tokens) - remaining_boxes)

        chunks.append(_trim_joined_tokens(tokens[cursor:best_end]))
        remaining_cost = max(0.0, remaining_cost - sum(token_costs[cursor:best_end]))
        total_capacity = max(1.0, total_capacity - max(1.0, capacity))
        cursor = best_end

    while len(chunks) < len(capacities):
        chunks.append("")
    return chunks[: len(capacities)]


def _build_single_render_block(block_id: str, item: dict, protected_text: str, formula_map: list[dict], font_size_pt: float, leading_em: float, render_kind: str) -> RenderBlock:
    return RenderBlock(
        block_id=block_id,
        bbox=item.get("bbox", []),
        inner_bbox=inner_bbox(item),
        markdown_text=build_markdown_from_parts(protected_text, formula_map),
        plain_text=build_plain_text_from_text(protected_text),
        render_kind=render_kind,
        font_size_pt=font_size_pt,
        leading_em=leading_em,
    )


def prepare_render_payloads_by_page(translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    prepared = {page_idx: deepcopy(items) for page_idx, items in translated_pages.items()}
    if not prepared:
        return prepared

    page_metrics: dict[int, tuple[float, float, float, float, float]] = {}
    flat_items: list[dict] = []
    for page_idx in sorted(prepared):
        items = prepared[page_idx]
        page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(items)
        text_widths = [bbox_width(item) for item in items if item.get("block_type") == "text"]
        page_text_width_med = median(text_widths) if text_widths else 0.0
        page_metrics[page_idx] = (
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
            page_text_width_med,
        )
        for item in items:
            item["render_protected_text"] = (item.get("protected_translated_text") or "").strip()
            item["render_formula_map"] = item.get("formula_map", [])
            flat_items.append(item)

    groups: dict[str, list[dict]] = {}
    for item in flat_items:
        group_id = item.get("continuation_group", "")
        if group_id:
            groups.setdefault(group_id, []).append(item)

    for group_id, items in groups.items():
        items = [item for item in items if (item.get("group_protected_translated_text") or "").strip()]
        if not items:
            continue
        group_formula_map = items[0].get("group_formula_map", [])
        protected_group_text = (items[0].get("group_protected_translated_text") or "").strip()
        capacities: list[float] = []
        for item in items:
            page_font_size, page_line_pitch, page_line_height, density_baseline, page_text_width_med = page_metrics[
                item.get("page_idx", 0)
            ]
            font_size_pt, leading_em = _block_metrics(
                item,
                page_font_size,
                page_line_pitch,
                page_line_height,
                density_baseline,
                page_text_width_med,
            )
            capacities.append(_box_capacity_units(inner_bbox(item), font_size_pt, leading_em))

        chunks = _split_protected_text_for_boxes(protected_group_text, group_formula_map, capacities)
        for item, chunk in zip(items, chunks):
            item["render_protected_text"] = chunk
            item["render_formula_map"] = group_formula_map

    return prepared


def build_render_blocks(translated_items: list[dict]) -> list[RenderBlock]:
    blocks: list[RenderBlock] = []
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(translated_items)
    text_widths = [bbox_width(item) for item in translated_items if item.get("block_type") == "text"]
    page_text_width_med = median(text_widths) if text_widths else 0.0
    for index, item in enumerate(translated_items):
        translated_text = (item.get("render_protected_text") or item.get("protected_translated_text") or "").strip()
        bbox = item.get("bbox", [])
        if len(bbox) != 4 or not translated_text:
            continue
        font_size_pt, leading_em = _block_metrics(
            item,
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
            page_text_width_med,
        )
        blocks.append(
            RenderBlock(
                block_id=f"item-{index}",
                bbox=bbox,
                inner_bbox=inner_bbox(item),
                markdown_text=build_markdown_from_parts(
                    translated_text,
                    item.get("render_formula_map") or item.get("formula_map", []),
                ),
                plain_text=build_plain_text_from_text(translated_text),
                render_kind=(
                    "plain_line"
                    if item.get("_force_plain_line") or _is_flag_like_plain_text_block(item)
                    else "markdown"
                ),
                font_size_pt=font_size_pt,
                leading_em=leading_em,
            )
        )
    return blocks
