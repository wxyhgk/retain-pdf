import re
from copy import deepcopy
from statistics import median

from rendering.font_fit import bbox_width
from rendering.font_fit import estimate_font_size_pt
from rendering.font_fit import estimate_leading_em
from rendering.font_fit import inner_bbox
from rendering.font_fit import is_body_text_candidate
from rendering.font_fit import visual_line_count
from rendering.font_fit import page_baseline_font_size
from rendering.math_utils import build_markdown_from_parts
from rendering.math_utils import build_markdown_paragraph
from rendering.math_utils import build_plain_text_from_text
from rendering.math_utils import build_plain_text
from rendering.models import RenderBlock


TOKEN_RE = re.compile(r"(\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|[\u4e00-\u9fff]|.)")
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*")
ZH_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
COMPACT_TRIGGER_RATIO = 0.9
COMPACT_SCALE = 0.9
HEAVY_COMPACT_RATIO = 1.0


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
    leading_em = estimate_leading_em(item, page_line_pitch, font_size_pt)
    return font_size_pt, leading_em


def _tokenize_protected_text(text: str) -> list[str]:
    return TOKEN_RE.findall(text or "")


def _strip_formula_placeholders(text: str) -> str:
    return re.sub(r"\[\[FORMULA_\d+]]", " ", text or "")


def _source_word_count(item: dict) -> int:
    source_text = item.get("protected_source_text") or item.get("source_text") or ""
    plain = _strip_formula_placeholders(source_text)
    return len(WORD_RE.findall(plain))


def _translated_zh_char_count(protected_text: str) -> int:
    plain = _strip_formula_placeholders(protected_text)
    return len(ZH_CHAR_RE.findall(plain))


def _translation_density_ratio(item: dict, protected_text: str) -> float:
    source_words = _source_word_count(item)
    if source_words <= 0:
        return 0.0
    zh_chars = _translated_zh_char_count(protected_text)
    if zh_chars <= 0:
        return 0.0
    return zh_chars / source_words


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


def _box_capacity_units(inner: list[float], font_size_pt: float, leading_em: float, visual_lines: int | None = None) -> float:
    if len(inner) != 4:
        return 0.0
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    lines = max(1, int(height / line_step))
    if visual_lines and visual_lines > 1:
        lines = min(lines, max(1, visual_lines + 1))
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    return lines * chars_per_line * 0.98


def _text_demand_units(protected_text: str, formula_map: list[dict]) -> float:
    if not protected_text:
        return 0.0
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    return sum(_token_units(token, formula_lookup) for token in _tokenize_protected_text(protected_text))


def _fit_translated_block_metrics(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    page_body_font_size_pt: float | None = None,
) -> tuple[float, float]:
    demand = _text_demand_units(protected_text, formula_map)
    density_ratio = _translation_density_ratio(item, protected_text)
    is_dense_block = density_ratio >= COMPACT_TRIGGER_RATIO
    is_heavy_dense_block = density_ratio >= HEAVY_COMPACT_RATIO
    visual_lines = visual_line_count(item)
    if item.get("_is_body_text_candidate", False) and page_body_font_size_pt is not None:
        floor_gap = 0.85 if is_heavy_dense_block else (0.65 if is_dense_block else 0.45)
        font_size_pt = round(max(font_size_pt, page_body_font_size_pt - floor_gap), 2)
    if demand <= 0:
        return font_size_pt, leading_em

    box = inner_bbox(item)
    capacity = _box_capacity_units(box, font_size_pt, leading_em, visual_lines=visual_lines)
    if capacity <= 0 or demand <= capacity * 0.96:
        return font_size_pt, leading_em

    best_font = font_size_pt
    best_leading = leading_em

    max_steps = 7 if (item.get("_is_body_text_candidate", False) and is_dense_block) else (4 if item.get("_is_body_text_candidate", False) else 7)
    min_font = max(
        8.8 if is_dense_block else 9.0,
        (page_body_font_size_pt - (0.7 if is_heavy_dense_block else 0.55 if is_dense_block else 0.4))
        if page_body_font_size_pt is not None
        else (8.8 if is_dense_block else 9.0),
    )
    for step in range(1, max_steps + 1):
        candidate_font = round(max(min_font, font_size_pt - step * 0.15), 2)
        candidate_capacity = _box_capacity_units(box, candidate_font, leading_em, visual_lines=visual_lines)
        if demand <= candidate_capacity * 0.98:
            return candidate_font, leading_em
        best_font = candidate_font

    if item.get("_is_body_text_candidate", False):
        emergency_leading = round(max(0.42 if is_dense_block else 0.5, leading_em - (0.12 if is_dense_block else 0.08)), 2)
        emergency_min_font = max(
            8.6 if is_dense_block else 8.8,
            (page_body_font_size_pt - (0.9 if is_heavy_dense_block else 0.75 if is_dense_block else 0.6))
            if page_body_font_size_pt is not None
            else (8.6 if is_dense_block else 8.8),
        )
        for step in range(1, 9 if is_dense_block else 6):
            candidate_font = round(max(emergency_min_font, best_font - step * 0.12), 2)
            candidate_capacity = _box_capacity_units(box, candidate_font, emergency_leading, visual_lines=visual_lines)
            if demand <= candidate_capacity * 0.98:
                return candidate_font, emergency_leading
            best_font = candidate_font
        return best_font, emergency_leading

    return best_font, best_leading


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
            item["render_protected_text"] = (
                item.get("translation_unit_protected_translated_text")
                or item.get("protected_translated_text")
                or ""
            ).strip()
            item["render_formula_map"] = item.get("translation_unit_formula_map") or item.get("formula_map", [])
            flat_items.append(item)

    units: dict[str, list[dict]] = {}
    for item in flat_items:
        unit_id = str(item.get("translation_unit_id", "") or "")
        if item.get("translation_unit_kind") == "group" and unit_id:
            units.setdefault(unit_id, []).append(item)

    for unit_id, items in units.items():
        items = [item for item in items if (item.get("translation_unit_protected_translated_text") or "").strip()]
        if not items:
            continue
        unit_formula_map = items[0].get("translation_unit_formula_map") or items[0].get("group_formula_map", [])
        protected_unit_text = (
            items[0].get("translation_unit_protected_translated_text")
            or items[0].get("group_protected_translated_text")
            or ""
        ).strip()
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

        chunks = _split_protected_text_for_boxes(protected_unit_text, unit_formula_map, capacities)
        for item, chunk in zip(items, chunks):
            item["render_protected_text"] = chunk
            item["render_formula_map"] = unit_formula_map

    return prepared


def build_render_blocks(translated_items: list[dict]) -> list[RenderBlock]:
    blocks: list[RenderBlock] = []
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(translated_items)
    text_widths = [bbox_width(item) for item in translated_items if item.get("block_type") == "text"]
    page_text_width_med = median(text_widths) if text_widths else 0.0
    body_base_sizes: list[float] = []
    body_flags: dict[int, bool] = {}
    base_metrics: dict[int, tuple[float, float]] = {}
    for index, item in enumerate(translated_items):
        item_with_flag = dict(item)
        item_with_flag["_is_body_text_candidate"] = is_body_text_candidate(item, page_text_width_med)
        body_flags[index] = item_with_flag["_is_body_text_candidate"]
        font_size_pt = estimate_font_size_pt(
            item_with_flag,
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
        )
        leading_em = estimate_leading_em(item_with_flag, page_line_pitch, font_size_pt)
        base_metrics[index] = (font_size_pt, leading_em)
        if item_with_flag["_is_body_text_candidate"]:
            body_base_sizes.append(font_size_pt)
    page_body_font_size_pt = round(median(body_base_sizes), 2) if body_base_sizes else None

    for index, item in enumerate(translated_items):
        translated_text = (
            item.get("render_protected_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("protected_translated_text")
            or ""
        ).strip()
        bbox = item.get("bbox", [])
        if len(bbox) != 4 or not translated_text:
            continue
        font_size_pt, leading_em = base_metrics[index]
        formula_map = item.get("render_formula_map") or item.get("translation_unit_formula_map") or item.get("formula_map", [])
        density_ratio = _translation_density_ratio(item, translated_text)
        is_dense_block = density_ratio >= COMPACT_TRIGGER_RATIO
        if body_flags.get(index) and page_body_font_size_pt is not None:
            down_band = 0.7 if is_dense_block else 0.45
            up_band = 0.35 if is_dense_block else 0.3
            font_size_pt = round(min(max(font_size_pt, page_body_font_size_pt - down_band), page_body_font_size_pt + up_band), 2)
        if is_dense_block and not body_flags.get(index):
            font_size_pt = round(font_size_pt * COMPACT_SCALE, 2)
            leading_em = round(leading_em * COMPACT_SCALE, 2)
        font_size_pt, leading_em = _fit_translated_block_metrics(
            {**item, "_is_body_text_candidate": body_flags.get(index, False)},
            translated_text,
            formula_map,
            font_size_pt,
            leading_em,
            page_body_font_size_pt=page_body_font_size_pt if body_flags.get(index) else None,
        )
        blocks.append(
            RenderBlock(
                block_id=f"item-{index}",
                bbox=bbox,
                inner_bbox=inner_bbox(item),
                markdown_text=build_markdown_from_parts(
                    translated_text,
                    formula_map,
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
