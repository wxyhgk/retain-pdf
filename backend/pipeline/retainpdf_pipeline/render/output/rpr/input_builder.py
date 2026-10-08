"""``list[RenderPageSpec]`` → rpr 引擎输入 ``rpr_retain_input_v1``。

字号、行距、首行缩进、对齐、字重、缩字许可都**照搬** Typst 路线算出来的值（page_specs 与
``block_renderer.build_typst_block`` 里生成 Typst 前的那几步），引擎只负责按这些参数精确排版。
逐块的对应关系：

- ``content_rect`` → ``content_box``（与 Typst 一样宽高至少 8pt；缩字块用 ``fit_dimensions``
  的宽度，单行拟合块用 ``single_line_fit_config`` 的宽度）；
- 底色：Typst 背景路线（typst / typst_visual）每块都画（``include_fill=True``），overlay 路线
  只在 ``use_cover_fill`` 时画；矩形是排版框裁到 ``background_rect``（OCR 擦除框）里，与
  ``_clipped_fill_rect_typst`` 相同；
- 公式安全 inset：``formula_safety_insets_pt``（与 Typst 同参，含 math_map 为空这一点）；
- 两端对齐：``justify_text`` 且没有长行内公式风险（block_renderer.py 的关闭条件）；
- 缩字：fit_to_box → ``box``，fit_single_line → ``single_line``，其余 ``fixed``；
  长行内公式时的最小字号 / 最小行距放宽与 Typst 相同。

引擎不擅长、被拆开或改写的分支（逐块计数进 ``stats``，不静默丢块）：
- ``toc_entries``：每条目录拆成「标题」「页码」两个单行块（标题左对齐、页码贴右沿），
  不画引导点；
- ``preserved_line_boxes``：每个保留行盒拆成一个单行拟合块，字号上下限照 Typst 的公式；
  底色逐行铺（引擎把底色裁到块自己的排版框里，铺不了整个擦除框）；
- ``preserve_line_breaks`` 但没有行盒：整块固定字号，换行是强制换行，不两端对齐；
- ``plain`` / ``plain_line``：≤40 字按宽度缩到一行（single_line，下限 1pt），更长的固定字号；
- ``skip_reason`` 非空（目前只有 adjacent_collision_risk）：Typst 路线照样渲染，这里也照样送。
"""

from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field

from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from retainpdf_pipeline.render.layout.model.block_view import layout_block_to_render_block
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.payload.formula_safety import formula_safety_insets_pt
from retainpdf_pipeline.render.layout.payload.formula_safety import has_long_inline_math_layout_risk
from retainpdf_pipeline.render.output.rpr.text import markdown_to_engine_text
from retainpdf_pipeline.render.output.rpr.text import plain_to_engine_text
from retainpdf_pipeline.render.output.typst import block_config as typst_config
from retainpdf_pipeline.render.output.typst.block_fields import typst_block_fields
from retainpdf_pipeline.render.output.typst.block_fit import fit_dimensions
from retainpdf_pipeline.render.output.typst.block_renderer import PLAIN_LINE_FIT_MAX_CHARS
from retainpdf_pipeline.render.output.typst.block_renderer import TOC_ENTRY_FONT_PT
from retainpdf_pipeline.render.output.typst.block_renderer import TOC_ENTRY_MIN_FONT_PT
from retainpdf_pipeline.render.output.typst.block_renderer import _toc_estimated_text_width_pt
from retainpdf_pipeline.render.output.typst.block_renderer import sanitize_typst_markdown_for_compile

RPR_INPUT_SCHEMA = "rpr_retain_input_v1"
# Typst 默认 par leading（行盒间隙）。行盒 / 目录这类 Typst 里不设 leading 的块用它。
DEFAULT_LEADING_EM = 0.65

BRANCH_FIXED = "fixed"
BRANCH_FIT_BOX = "fit_box"
BRANCH_FIT_SINGLE_LINE = "fit_single_line"
BRANCH_PLAIN_SHORT = "plain_line_scaled"
BRANCH_PLAIN_LONG = "plain_fixed"
BRANCH_PRESERVED_LINES = "preserved_line_breaks"
BRANCH_LINE_BOXES = "preserved_line_boxes"
BRANCH_TOC = "toc_entries"
BRANCH_EMPTY = "empty_text"


@dataclass
class RprInputStats:
    """每类分支的块数（按译文块计）与拆出来的引擎块数，写进摘要。"""

    layout_blocks: int = 0
    engine_blocks: int = 0
    branches: dict[str, int] = field(default_factory=dict)
    split_engine_blocks: dict[str, int] = field(default_factory=dict)
    skip_reason_blocks: dict[str, int] = field(default_factory=dict)
    obstacles: int = 0
    obstacle_kinds: dict[str, int] = field(default_factory=dict)

    def count(self, branch: str, engine_blocks: int) -> None:
        self.branches[branch] = self.branches.get(branch, 0) + 1
        self.engine_blocks += engine_blocks
        if branch in {BRANCH_TOC, BRANCH_LINE_BOXES}:
            self.split_engine_blocks[branch] = self.split_engine_blocks.get(branch, 0) + engine_blocks

    def as_dict(self) -> dict[str, object]:
        return {
            "layout_blocks": self.layout_blocks,
            "engine_blocks": self.engine_blocks,
            "branches": dict(sorted(self.branches.items())),
            "split_engine_blocks": dict(sorted(self.split_engine_blocks.items())),
            "skip_reason_blocks": dict(sorted(self.skip_reason_blocks.items())),
            "obstacles": self.obstacles,
            "obstacle_kinds": dict(sorted(self.obstacle_kinds.items())),
        }


@dataclass(frozen=True)
class RprBuiltInput:
    payload: dict
    stats: RprInputStats
    # 引擎块 id → (页序号, 译文块 block_id)，报告转换时按译文块聚合
    engine_block_owner: dict[str, tuple[int, str]]
    # 译文块 block_id → RenderBlock（报告里取 base 字号、字数）
    layout_blocks: dict[tuple[int, str], RenderBlock]
    # 译文块 block_id → 分支
    block_branches: dict[tuple[int, str], str]


def item_id_for_block_id(block_id: str) -> str:
    text = str(block_id or "")
    return text[len("item-"):] if text.startswith("item-") else text


def _round(value: float, digits: int = 3) -> float:
    return round(float(value), digits)


def _rgb(color) -> list[float]:
    values = list(color or (0.0, 0.0, 0.0))[:3]
    while len(values) < 3:
        values.append(0.0)
    return [_round(max(0.0, min(1.0, float(value))), 4) for value in values]


def _box(x0: float, y0: float, x1: float, y1: float) -> list[float]:
    return [_round(x0), _round(y0), _round(x1), _round(y1)]


def _clipped_cover(block: RenderBlock, x0: float, y0: float, x1: float, y1: float) -> list[float] | None:
    """与 block_renderer._clipped_fill_rect_typst 相同：排版框裁到 OCR 擦除框里。"""
    cover = block.cover_bbox
    if cover is not None and len(cover) == 4:
        cx0, cy0, cx1, cy1 = (float(value) for value in cover)
        if cx1 > cx0 and cy1 > cy0:
            x0, y0, x1, y1 = max(x0, cx0), max(y0, cy0), min(x1, cx1), min(y1, cy1)
    if x1 - x0 <= 0.0 or y1 - y0 <= 0.0:
        return None
    return _box(x0, y0, x1, y1)


def _fixed_fit() -> dict:
    return {
        "mode": "fixed",
        "min_font_size_pt": None,
        "max_font_size_pt": None,
        "min_leading_em": None,
        "max_height_pt": None,
        "target_width_pt": None,
        "target_height_pt": None,
    }


def _single_line_fit(*, min_font: float, max_font: float, max_height: float, target_width=None, target_height=None) -> dict:
    return {
        "mode": "single_line",
        "min_font_size_pt": _round(min_font, 3),
        "max_font_size_pt": _round(max_font, 3),
        "min_leading_em": None,
        "max_height_pt": _round(max_height, 3),
        "target_width_pt": _round(target_width, 3) if target_width else None,
        "target_height_pt": _round(target_height, 3) if target_height else None,
    }


def _engine_block(
    *,
    engine_id: str,
    item_id: str,
    content_box: list[float],
    cover_box: list[float] | None,
    cover_fill,
    text_color,
    text: str,
    font_weight: str,
    align: str,
    first_line_indent_pt: float,
    inset_top_pt: float,
    inset_bottom_pt: float,
    shift_up_pt: float,
    font_size_pt: float,
    leading_em: float,
    fit: dict,
) -> dict:
    return {
        "id": engine_id,
        "item_id": item_id,
        "content_box": content_box,
        "cover_box": cover_box,
        "cover_fill": _rgb(cover_fill) if cover_box is not None else None,
        "text_color": _rgb(text_color),
        "text": text,
        "font_weight": "bold" if str(font_weight or "").strip().lower() == "bold" else "regular",
        "align": align,
        "first_line_indent_pt": _round(max(0.0, first_line_indent_pt), 3),
        "inset_top_pt": _round(inset_top_pt, 3),
        "inset_bottom_pt": _round(inset_bottom_pt, 3),
        "shift_up_pt": _round(max(0.0, shift_up_pt), 3),
        "font_size_pt": _round(font_size_pt, 3),
        "leading_em": _round(leading_em, 4),
        "fit": fit,
    }


def _toc_blocks(block: RenderBlock, *, engine_prefix: str, item_id: str) -> list[dict]:
    """目录条目：与 _build_toc_entry_typst 同样的字号与缩进，拆成标题块 + 页码块。"""
    out: list[dict] = []
    for index, entry in enumerate(block.toc_entries or []):
        if len(entry.bbox) != 4 or not str(entry.title or "").strip():
            continue
        x0, y0, x1, y1 = [float(value) for value in entry.bbox]
        width = max(typst_config.MIN_BLOCK_SIZE_PT, x1 - x0)
        height = max(typst_config.MIN_BLOCK_SIZE_PT, y1 - y0)
        indent = round(max(0, int(entry.level or 1) - 1) * min(18.0, width * 0.06), 2)
        max_font_pt = round(max(1.0, min(TOC_ENTRY_FONT_PT, height * 0.82)), 2)
        min_font_pt = round(max(1.0, min(max_font_pt, TOC_ENTRY_MIN_FONT_PT, height * 0.58)), 2)
        prefix = f"{entry.number} " if str(entry.number or "").strip() else ""
        page_label = str(entry.page_label or "").strip()
        left = x0 + indent
        right = x0 + width
        page_width = _toc_estimated_text_width_pt(page_label, max_font_pt) if page_label else 0.0
        title_right = max(left + typst_config.MIN_BLOCK_SIZE_PT, right - page_width - 8.0) if page_label else right
        common = {
            "cover_box": None,
            "cover_fill": block.cover_fill,
            "text_color": block.text_color,
            "font_weight": block.font_weight,
            "align": "left",
            "first_line_indent_pt": 0.0,
            "inset_top_pt": 0.0,
            "inset_bottom_pt": 0.0,
            "shift_up_pt": 0.0,
            "font_size_pt": max_font_pt,
            "leading_em": 0.15,
        }
        out.append(
            _engine_block(
                engine_id=f"{engine_prefix}/toc{index}",
                item_id=item_id,
                content_box=_box(left, y0, title_right, y0 + height),
                text=markdown_to_engine_text(
                    sanitize_typst_markdown_for_compile(f"{prefix}{entry.title}")
                ),
                fit=_single_line_fit(min_font=min_font_pt, max_font=max_font_pt, max_height=height),
                **common,
            )
        )
        if page_label:
            out.append(
                _engine_block(
                    engine_id=f"{engine_prefix}/toc{index}p",
                    item_id=item_id,
                    content_box=_box(max(left, right - page_width), y0, right, y0 + height),
                    text=plain_to_engine_text(page_label),
                    fit=_single_line_fit(min_font=min_font_pt, max_font=max_font_pt, max_height=height),
                    **common,
                )
            )
    return out


def _line_box_blocks(block: RenderBlock, *, engine_prefix: str, item_id: str, draw_fill: bool) -> list[dict]:
    """保留行盒：与 _build_preserved_line_box_typst 同样的单行字号上下限。"""
    out: list[dict] = []
    for index, line in enumerate(block.preserved_line_boxes or []):
        if len(line.bbox) != 4 or not str(line.text or "").strip():
            continue
        line_markdown = build_direct_typst_passthrough_text(str(line.text or ""))
        x0, y0, x1, y1 = [float(value) for value in line.bbox]
        width = max(typst_config.MIN_BLOCK_SIZE_PT, x1 - x0)
        height = max(typst_config.MIN_BLOCK_SIZE_PT, y1 - y0)
        max_font_pt = round(max(1.0, min(block.font_size_pt, height * 0.86)), 2)
        text_units = max(1, len(line_markdown.strip()))
        dense_single_line = text_units / max(width, 1.0) > 0.38
        min_scale = 0.36 if dense_single_line else 0.58
        min_floor = 4.8 if dense_single_line else 1.0
        min_font_pt = round(max(min_floor, min(max_font_pt, height * min_scale)), 2)
        # Typst 在 use_cover_fill 时先给整个擦除框铺底色；引擎把底色裁到每块自己的排版框里，
        # 所以这里只能逐行铺（行与行之间的缝不铺，原文本来就在行盒里）。
        cover = _clipped_cover(block, x0, y0, x0 + width, y0 + height) if draw_fill else None
        out.append(
            _engine_block(
                engine_id=f"{engine_prefix}/l{index}",
                item_id=item_id,
                content_box=_box(x0, y0, x0 + width, y0 + height),
                cover_box=cover,
                cover_fill=block.cover_fill,
                text_color=block.text_color,
                text=markdown_to_engine_text(line_markdown),
                font_weight=block.font_weight,
                align="left",
                first_line_indent_pt=0.0,
                inset_top_pt=0.0,
                inset_bottom_pt=0.0,
                shift_up_pt=0.0,
                font_size_pt=max_font_pt,
                leading_em=DEFAULT_LEADING_EM,
                fit=_single_line_fit(min_font=min_font_pt, max_font=max_font_pt, max_height=height),
            )
        )
    return out


def engine_blocks_for_layout_block(
    block: RenderBlock,
    *,
    engine_prefix: str,
    include_fill: bool,
    box_mode: str = "box",
) -> tuple[str, list[dict]]:
    """一个译文块 → (分支名, 引擎块列表)。与 block_renderer.build_typst_block 的分支一一对应。"""
    item_id = item_id_for_block_id(block.block_id)
    fields = typst_block_fields(
        engine_prefix,
        block.inner_bbox,
        font_size_pt=block.font_size_pt,
        leading_em=block.leading_em,
        font_weight=block.font_weight,
    )
    draw_fill = include_fill or block.use_cover_fill

    def cover(x0: float, y0: float, width: float, height: float) -> list[float] | None:
        if not draw_fill:
            return None
        return _clipped_cover(block, x0, y0, x0 + width, y0 + height)

    def single(**overrides) -> dict:
        base = {
            "engine_id": engine_prefix,
            "item_id": item_id,
            "content_box": _box(fields.x0, fields.y0, fields.x0 + fields.width, fields.y0 + fields.height),
            "cover_box": cover(fields.x0, fields.y0, fields.width, fields.height),
            "cover_fill": block.cover_fill,
            "text_color": block.text_color,
            "text": "",
            "font_weight": fields.font_weight,
            "align": "left",
            "first_line_indent_pt": 0.0,
            "inset_top_pt": 0.0,
            "inset_bottom_pt": 0.0,
            "shift_up_pt": 0.0,
            "font_size_pt": fields.font_size,
            "leading_em": fields.leading,
            "fit": _fixed_fit(),
        }
        base.update(overrides)
        return _engine_block(**base)

    if block.render_kind in {"plain", "plain_line"}:
        text = plain_to_engine_text(block.plain_text)
        if len(block.plain_text) > PLAIN_LINE_FIT_MAX_CHARS:
            return BRANCH_PLAIN_LONG, [
                single(
                    text=text,
                    align="justify" if block.justify_text else "left",
                    first_line_indent_pt=typst_config.first_line_indent_pt(block.first_line_indent_pt),
                )
            ]
        # Typst：按自然宽度等比缩到框宽，不设下限。
        return BRANCH_PLAIN_SHORT, [
            single(
                text=text,
                fit=_single_line_fit(
                    min_font=typst_config.MIN_FIT_FONT_SIZE_PT,
                    max_font=fields.font_size,
                    max_height=fields.height,
                ),
            )
        ]

    markdown = sanitize_typst_markdown_for_compile(block.markdown_text)
    insets = formula_safety_insets_pt(
        markdown,
        block.math_map,
        font_size_pt=fields.font_size,
        box_height_pt=fields.height,
    )
    long_inline_math_risk = has_long_inline_math_layout_risk(
        markdown,
        block.math_map,
        font_size_pt=fields.font_size,
        box_width_pt=fields.width,
    )
    content_fit_height = max(typst_config.MIN_BLOCK_SIZE_PT, fields.height - insets.total_pt)
    first_line_indent = typst_config.first_line_indent_pt(block.first_line_indent_pt)
    align = "justify" if (block.justify_text and not long_inline_math_risk) else "left"

    if block.toc_entries:
        return BRANCH_TOC, _toc_blocks(block, engine_prefix=engine_prefix, item_id=item_id)
    if block.preserve_line_breaks and block.preserved_line_boxes:
        return BRANCH_LINE_BOXES, _line_box_blocks(
            block, engine_prefix=engine_prefix, item_id=item_id, draw_fill=draw_fill
        )
    if block.preserve_line_breaks and "\n" in markdown:
        return BRANCH_PRESERVED_LINES, [
            single(
                text=markdown_to_engine_text(markdown, preserve_line_breaks=True),
                align="left",
                inset_top_pt=insets.top_pt,
                inset_bottom_pt=insets.bottom_pt,
            )
        ]
    text = markdown_to_engine_text(markdown)
    if block.fit_to_box and block.fit_single_line:
        config = typst_config.single_line_fit_config(
            width_pt=fields.width,
            height_pt=content_fit_height,
            font_size_pt=fields.font_size,
            fit_min_font_size_pt=block.fit_min_font_size_pt,
            fit_max_font_size_pt=block.fit_max_font_size_pt,
            fit_max_height_pt=min(content_fit_height, block.fit_max_height_pt or content_fit_height),
            fit_target_width_pt=block.fit_target_width_pt,
            fit_target_height_pt=min(content_fit_height, block.fit_target_height_pt or content_fit_height),
            fit_shift_up_pt=block.fit_shift_up_pt,
        )
        return BRANCH_FIT_SINGLE_LINE, [
            single(
                content_box=_box(fields.x0, fields.y0, fields.x0 + config.width_pt, fields.y0 + fields.height),
                # Typst 的底色同样跟着上移
                cover_box=cover(fields.x0, fields.y0 - config.shift_up_pt, config.width_pt, fields.height),
                text=text,
                align=align,
                inset_top_pt=insets.top_pt,
                inset_bottom_pt=insets.bottom_pt,
                shift_up_pt=config.shift_up_pt,
                font_size_pt=config.max_font_pt,
                fit=_single_line_fit(
                    min_font=config.min_font_pt,
                    max_font=config.max_font_pt,
                    max_height=config.height_pt,
                    target_width=block.fit_target_width_pt or None,
                    target_height=block.fit_target_height_pt or None,
                ),
            )
        ]
    if block.fit_to_box:
        fit = fit_dimensions(
            width=fields.width,
            height=content_fit_height,
            font_size=fields.font_size,
            leading=fields.leading,
            fit_min_font_size_pt=(
                min(block.fit_min_font_size_pt or fields.font_size, fields.font_size * 0.72)
                if long_inline_math_risk
                else block.fit_min_font_size_pt
            ),
            fit_min_leading_em=(
                max(block.fit_min_leading_em or fields.leading, min(fields.leading, 0.62))
                if long_inline_math_risk
                else block.fit_min_leading_em
            ),
            fit_max_height_pt=min(content_fit_height, block.fit_max_height_pt or content_fit_height),
        )
        return BRANCH_FIT_BOX, [
            single(
                content_box=_box(fields.x0, fields.y0, fields.x0 + fit["width"], fields.y0 + fields.height),
                cover_box=cover(fields.x0, fields.y0, fit["width"], fields.height),
                text=text,
                align=align,
                first_line_indent_pt=first_line_indent,
                inset_top_pt=insets.top_pt,
                inset_bottom_pt=insets.bottom_pt,
                fit={
                    # box：typst / typst_visual 的 page-spec helper；box_overlay：overlay 路线的
                    # helper（低于下限进应急档、行距二分回升）。两者参数相同，只是缩字规则不同。
                    "mode": box_mode,
                    "min_font_size_pt": _round(fit["fit_min_font"], 3),
                    "max_font_size_pt": _round(fields.font_size, 3),
                    "min_leading_em": _round(fit["fit_min_leading"], 4),
                    "max_height_pt": _round(fit["fit_target_height"], 3),
                    "target_width_pt": None,
                    "target_height_pt": None,
                },
            )
        ]
    return BRANCH_FIXED, [
        single(
            text=text,
            align=align,
            first_line_indent_pt=first_line_indent,
            inset_top_pt=insets.top_pt,
            inset_bottom_pt=insets.bottom_pt,
        )
    ]


@dataclass
class RprPage:
    """overlay 路线的一页：与 RenderPageSpec 同名字段，块是已经算好的 RenderBlock。"""

    page_index: int
    page_width_pt: float
    page_height_pt: float
    blocks: list[RenderBlock]


def build_rpr_input(
    page_specs: list[RenderPageSpec] | list[RprPage],
    *,
    font_family: str,
    include_fill: bool,
    obstacles_by_page: dict[int, list[dict]] | None = None,
    box_mode: str = "box",
) -> RprBuiltInput:
    stats = RprInputStats()
    owners: dict[str, tuple[int, str]] = {}
    layout_blocks: dict[tuple[int, str], RenderBlock] = {}
    branches: dict[tuple[int, str], str] = {}
    pages: list[dict] = []
    for page_offset, spec in enumerate(page_specs):
        engine_blocks: list[dict] = []
        for block_index, layout_block in enumerate(spec.blocks):
            block = layout_block if isinstance(layout_block, RenderBlock) else layout_block_to_render_block(layout_block)
            stats.layout_blocks += 1
            if block.skip_reason:
                stats.skip_reason_blocks[block.skip_reason] = stats.skip_reason_blocks.get(block.skip_reason, 0) + 1
            # 与 Typst 源码里的 block_id 同一套命名，排查时两边对得上
            engine_prefix = f"rp{page_offset}_{block.block_id}_{block_index}"
            branch, produced = engine_blocks_for_layout_block(
                block, engine_prefix=engine_prefix, include_fill=include_fill, box_mode=box_mode
            )
            if not any(entry["text"] for entry in produced):
                # 没有可排的字：块照样送（Typst 路线也会画底色），分支记成 empty_text
                branch = BRANCH_EMPTY
            stats.count(branch, len(produced))
            key = (page_offset, layout_block.block_id)
            layout_blocks[key] = block
            branches[key] = branch
            for entry in produced:
                owners[entry["id"]] = key
            engine_blocks.extend(produced)
        page_obstacles = list((obstacles_by_page or {}).get(spec.page_index, []))
        for obstacle in page_obstacles:
            stats.obstacles += 1
            kind = str(obstacle.get("kind") or "other")
            stats.obstacle_kinds[kind] = stats.obstacle_kinds.get(kind, 0) + 1
        pages.append(
            {
                "index": page_offset,
                "source_page_index": spec.page_index,
                "width": _round(spec.page_width_pt),
                "height": _round(spec.page_height_pt),
                "blocks": engine_blocks,
                "obstacles": page_obstacles,
            }
        )
    payload = {
        "schema": RPR_INPUT_SCHEMA,
        "font": {"family": font_family},
        "pages": pages,
    }
    return RprBuiltInput(
        payload=payload,
        stats=stats,
        engine_block_owner=owners,
        layout_blocks=layout_blocks,
        block_branches=branches,
    )


__all__ = [
    "RPR_INPUT_SCHEMA",
    "RprBuiltInput",
    "RprInputStats",
    "RprPage",
    "build_rpr_input",
    "engine_blocks_for_layout_block",
    "item_id_for_block_id",
]
