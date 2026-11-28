"""目录原位替换：排版前定好每条怎么换（2026-11-28 用户定，docs/ops/planning/toc-agent/20261128-用户定：目录页原位替换.md）。

在原文 PDF 上逐页定：每条目录（``structure_role = toc_entry``，归一化时 R0 记下了只框标题的字的每一行
``toc_entry_title_lines``）的译文写在哪几行、多大字号，擦哪些字；然后在这一页的副本上真擦一遍、跑检查
（``page_ops.py``）。擦到了别的字、擦不干净的条目改成保留原文，再试一遍；还不行这一页退回重排（reflow）。

定好的页，目录条目和页码小块在正文排版里都当保留原文（不擦、不排），正文排完以后
``apply.py`` 在译文 PDF 上照这份计划擦字、写字，阅读页的版面跟着补。

规则（用户定）：
- 只擦标题的字；章号、标签列（Chapter 1）、点线、页码、页眉都留在原图上；页码小块不擦不画。
- 译文写在原标题首字的 x、原基线上，字号取原标题的字号，一律常规体、黑色（和正文同一套字体）。
  每行宽度到右边第一个留下来的字（点线或页码）前 0.3 个字。
- 多行标题按原来每行的宽度切回原行；用不完的行留空。没有章号、标签，页码在末行，末几行放得下时放到末几行（和页码同一行）。
- 放不下这一条缩字号，最低 0.8 倍；还放不下保留原文，记下来留给认上下文的 agent（R2）。
- 没译文、译文和原文一样（References、人名）的条目原字不动。
- 扫描件（文字层看不见）：按标题的行框（去掉章号、标签、页码、点线）在图上盖这一行周围的底色再写。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from retainpdf_pipeline.render.layout.model.render_text import render_protected_translation_text
from retainpdf_pipeline.render.layout.payload.toc_page_labels import held_item
from retainpdf_pipeline.render.output.toc_replace import page_ops
from retainpdf_pipeline.render.output.toc_replace.text import MARKUP_RE
from retainpdf_pipeline.render.output.toc_replace.text import Char
from retainpdf_pipeline.render.output.toc_replace.text import chars_in
from retainpdf_pipeline.render.output.toc_replace.text import has_cjk
from retainpdf_pipeline.render.output.toc_replace.text import meaningful
from retainpdf_pipeline.render.output.toc_replace.text import median
from retainpdf_pipeline.render.output.toc_replace.text import missing_glyphs
from retainpdf_pipeline.render.output.toc_replace.text import page_chars
from retainpdf_pipeline.render.output.toc_replace.text import place
from retainpdf_pipeline.render.output.toc_replace.text import split_to_lines
from retainpdf_pipeline.render.output.toc_replace.text import title_translation
from retainpdf_pipeline.render.policy.cleanup_policy import item_is_marked_non_translated

TOC_MODE_REFLOW = "reflow"
TOC_MODE_REPLACE = "replace"
TOC_ENTRY_ROLE = "toc_entry"
TOC_PAGE_LABEL_ROLE = "toc_page_label"
MIN_SCALE = 0.8
SCALE_STEP = 0.02
# 译文离右边留下来的字（点线、页码）至少这么多个字宽
RIGHT_GAP_EM = 0.3
# 一页的标题字有这么多是看不见的（文字渲染模式 3），这一页当扫描件
SCAN_INVISIBLE_SHARE = 0.5
# 试擦最多几轮（擦坏了别的字、擦不干净的条目改成保留原文再试）
TRIAL_ROUNDS = 3

REPLACED_STATUSES = frozenset({"placed", "shrunk"})
HELD_FLAG = "toc_replace_held"


@dataclass
class LinePlan:
    text: str
    x: float
    baseline: float
    size: float
    width: float
    items: list[tuple[float, str]]

    def rect(self) -> list[float]:
        return [self.x, self.baseline - 0.88 * self.size, self.x + self.width, self.baseline + 0.12 * self.size]


@dataclass
class EntryPlan:
    block_id: str
    status: str
    source_title: str = ""
    title: str = ""
    src_lines: int = 0
    size: float = 0.0
    scale: float = 1.0
    erase: str = ""  # chars（按字擦文字层）/ cover（扫描件：图上盖底色）
    title_rects: list[list[float]] = field(default_factory=list)  # 原标题每一行的字框（擦的范围）
    probes: list[list[float]] = field(default_factory=list)
    covers: list[dict] = field(default_factory=list)  # {rect, fill}
    title_keys: list[tuple] = field(default_factory=list)
    protected: list[list[float]] = field(default_factory=list)  # 章号、标签、页码、点线：不许擦到
    lines: list[LinePlan] = field(default_factory=list)
    has_number: bool = False
    page_on_last_line: bool = False
    on_page_line: bool = False
    gap_src_em: float | None = None
    gap_new_em: float | None = None
    detail: str = ""
    text_layer: str = ""  # R2 写的 toc_entry_text_layer：visible / invisible（扫描件），没有时空

    @property
    def replaced(self) -> bool:
        return self.status in REPLACED_STATUSES

    def summary(self) -> dict:
        out = {"block_id": self.block_id, "status": self.status, "src_lines": self.src_lines, "used_lines": len(self.lines)}
        if self.replaced:
            out.update(scale=round(self.scale, 3), size=round(self.size * self.scale, 2), erase=self.erase)
        if self.detail:
            out["detail"] = self.detail
        return out


@dataclass
class PagePlan:
    page_index: int
    mode: str  # text / scan
    entries: list[EntryPlan]
    held_ids: set[str]
    trial: dict = field(default_factory=dict)

    def replaced(self) -> list[EntryPlan]:
        return [entry for entry in self.entries if entry.replaced]


@dataclass
class TocReplacePlan:
    font_path: Path | None
    pages: dict[int, PagePlan] = field(default_factory=dict)
    reflow_pages: dict[int, str] = field(default_factory=dict)

    def hold(self, pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
        """定好的页：目录条目和页码小块都当保留原文（正文排版不擦不排，排完由 apply 换字）。"""
        if not self.pages:
            return pages
        result: dict[int, list[dict]] = {}
        for page_idx, items in pages.items():
            plan = self.pages.get(int(page_idx))
            if plan is None:
                result[page_idx] = items
                continue
            result[page_idx] = [
                held_item(item, HELD_FLAG) if isinstance(item, dict) and str(item.get("item_id") or "") in plan.held_ids else item
                for item in items
            ]
        return result

    def diagnostics(self) -> dict:
        statuses: dict[str, int] = {}
        needs_model: list[dict] = []
        for plan in self.pages.values():
            for entry in plan.entries:
                statuses[entry.status] = statuses.get(entry.status, 0) + 1
                if entry.status in ("kept_does_not_fit", "kept_erase_collateral", "kept_erase_residual"):
                    needs_model.append({"page": plan.page_index, "block_id": entry.block_id, "reason": entry.status})
        return {
            "mode": TOC_MODE_REPLACE,
            "font": self.font_path.name if self.font_path else "",
            "pages": sorted(self.pages),
            "scan_pages": sorted(index for index, plan in self.pages.items() if plan.mode == "scan"),
            "reflow_pages": {str(index): reason for index, reason in sorted(self.reflow_pages.items())},
            "entries": statuses,
            # 放不下、擦不干净的条目：保留原文，留给认上下文的 agent（R2）看
            "needs_model": needs_model,
        }


def _role(item: dict) -> str:
    return str(item.get("structure_role") or "").strip().lower()


def load_document_blocks(document_path: Path | None) -> dict[tuple[int, str], dict]:
    """document.v1 里的目录块（R0 的 metadata 在这里；老任务的译文条目里没有）。"""
    if document_path is None or not Path(document_path).is_file():
        return {}
    document = json.loads(Path(document_path).read_text(encoding="utf-8"))
    found: dict[tuple[int, str], dict] = {}
    for page in document.get("pages") or []:
        index = int(page.get("page_index", -1))
        for block in page.get("blocks") or []:
            if isinstance(block, dict) and _role(block) in (TOC_ENTRY_ROLE, TOC_PAGE_LABEL_ROLE):
                found[(index, str(block.get("block_id") or ""))] = block
    return found


def _metadata(item: dict, block: dict | None) -> dict:
    merged = dict(item.get("metadata") or {}) if isinstance(item.get("metadata"), dict) else {}
    if block is not None:
        merged.update(block.get("metadata") or {})
    return merged


def _translated_text(item: dict) -> str:
    if item_is_marked_non_translated(item):
        return ""
    return render_protected_translation_text(item)


def _box(value) -> list[float] | None:
    if isinstance(value, (list, tuple)) and len(value) == 4:
        return [float(v) for v in value]
    return None


def _row_neighbors(chars: list[Char], mine: set[int], baseline: float, size: float) -> list[Char]:
    return [c for c in chars if id(c) not in mine and not c.c.isspace() and abs(c.base - baseline) < size * 0.5]


def _plan_entry(item: dict, md: dict, chars: list[Char], font, block_box: list[float]) -> tuple[EntryPlan, list[list[Char]]]:
    block_id = str(item.get("item_id") or "")
    title_lines = [line for line in md.get("toc_entry_title_lines") or [] if isinstance(line, dict) and _box(line.get("bbox"))]
    number = str(md.get("toc_entry_number") or "").strip()
    label = str(md.get("toc_entry_label") or "").strip()
    entry = EntryPlan(block_id=block_id, status="", source_title=str(md.get("toc_entry_title") or ""),
                      src_lines=len(title_lines), has_number=bool(number or label))
    for key in ("toc_entry_number_bbox", "toc_entry_label_bbox", "toc_entry_page_bbox"):
        box = _box(md.get(key))
        if box:
            entry.protected.append(box)
    # 认上下文的 agent（R2）认出的作者行：留在原图上，扫描件盖底色也不许盖到
    for line in md.get("toc_entry_author_lines") or []:
        box = _box(line.get("bbox") if isinstance(line, dict) else line)
        if box:
            entry.protected.append(box)
    entry.text_layer = str(md.get("toc_entry_text_layer") or "")
    if md.get("toc_entry_keep_original"):
        # R2 判这一条不翻（代码名、人名、不是条目……）：原字不动，不擦不写
        entry.status, entry.detail = "kept_original", str(md.get("toc_entry_keep_reason") or "")[:80]
        return entry, []
    line_chars = [chars_in(chars, line["bbox"]) for line in title_lines]
    if not title_lines or not any(line_chars):
        entry.status = "kept_no_title"
        return entry, []
    raw = _translated_text(item)
    title = title_translation(raw, number=number, label=label, page_label=str(md.get("toc_entry_page_label") or ""),
                              source_title=entry.source_title)
    if not raw or not title:
        entry.status = "kept_no_translation"
        return entry, line_chars
    source_text = str(item.get("source_text") or "")
    if meaningful(title) in (meaningful(entry.source_title), meaningful(source_text)):
        entry.status = "kept_same_as_source"
        return entry, line_chars
    if not has_cjk(title) and not has_cjk(entry.source_title or source_text):
        # 译文里一个中文字都没有（人名、代码名、模型只交回了原文的一段）：换上去也还是原文，原字不动
        entry.status, entry.detail = "kept_same_as_source", "no_cjk"
        return entry, line_chars
    if MARKUP_RE.search(title) or "\n" in title:
        entry.status, entry.detail = "kept_markup", title[:80]
        return entry, line_chars
    missing = missing_glyphs(title, font)
    if missing:
        entry.status, entry.detail = "kept_missing_glyph", "".join(missing[:10])
        return entry, line_chars
    entry.title = title
    # 每一行：起点（原首字的 x）、基线、能用的宽度（到右边第一个留下来的字前 0.3 个字）
    size = float(title_lines[0].get("size") or 0) or median(c.size for c in line_chars[0] or line_chars[-1])
    entry.size = size
    specs: list[dict] = []
    for line, cs in zip(title_lines, line_chars):
        if not cs:
            continue
        baseline = float(line.get("baseline") or 0) or median(c.base for c in cs)
        mine = {id(c) for c in cs}
        end = cs[-1].x1
        right = [c.x0 for c in _row_neighbors(chars, mine, baseline, size) if c.x0 >= end - 0.01]
        right_obj = min(right) if right else None
        limit = right_obj - RIGHT_GAP_EM * size if right_obj is not None else max(block_box[2], end)
        specs.append({"x0": cs[0].x0, "baseline": baseline, "end": end, "limit": limit, "right_obj": right_obj})
    widths = [spec["limit"] - spec["x0"] for spec in specs]
    page_box = _box(md.get("toc_entry_page_bbox"))
    if page_box is not None and specs:
        last = specs[-1]
        center = (page_box[1] + page_box[3]) / 2
        entry.page_on_last_line = abs(center - (last["baseline"] - 0.3 * size)) < size * 0.7
    scale, parts = 1.0, None
    while scale >= MIN_SCALE - 1e-9:
        parts = split_to_lines(title, font, size * scale, widths)
        if parts is not None:
            break
        scale = round(scale - SCALE_STEP, 4)
    if parts is None:
        entry.status = "kept_does_not_fit"
        return entry, line_chars
    used = specs[: len(parts)]
    if len(parts) < len(specs) and not entry.has_number and entry.page_on_last_line:
        pad = len(specs) - len(parts)
        tail = split_to_lines(title, font, size * scale, widths[pad:])
        if tail is not None and len(tail) == len(parts):
            parts, used = tail, specs[pad:]
            entry.on_page_line = True
    elif len(parts) == len(specs) and entry.page_on_last_line:
        entry.on_page_line = True
    font_size = size * scale
    for text, spec in zip(parts, used):
        offsets, width = place(text, font, font_size)
        items = [(round(spec["x0"] + offset, 3), ch) for offset, ch in offsets]
        entry.lines.append(LinePlan(text=text, x=spec["x0"], baseline=spec["baseline"], size=font_size, width=width, items=items))
    last_spec, last_line = used[-1], entry.lines[-1]
    if last_spec["right_obj"] is not None:
        entry.gap_src_em = round((last_spec["right_obj"] - last_spec["end"]) / size, 2)
        entry.gap_new_em = round((last_spec["right_obj"] - (last_line.x + last_line.width)) / size, 2)
    entry.scale = scale
    entry.status = "placed" if scale > 0.999 else "shrunk"
    return entry, line_chars


def _erase_specs(entry: EntryPlan, line_chars: list[list[Char]], chars: list[Char], mode: str, page, pixels=None) -> None:
    """擦哪里：文字层每行一根细探针（从首字中心到末字中心，只碰到标题的字）；扫描件每行一个盖底色的框。"""
    entry.erase = "cover" if mode == "scan" else "chars"
    entry.probes, entry.covers, entry.title_rects, entry.title_keys = [], [], [], []
    title_ids = {id(c) for cs in line_chars for c in cs}
    for cs in line_chars:
        if not cs:
            continue
        rect = [min(c.x0 for c in cs), min(c.y0 for c in cs), max(c.x1 for c in cs), max(c.y1 for c in cs)]
        entry.title_rects.append(rect)
        entry.title_keys.extend(c.key() for c in cs)
        cy = median(c.cy for c in cs)
        line_base = median(c.base for c in cs)
        entry.probes.append([cs[0].cx - 0.1, cy - 0.1, cs[-1].cx + 0.1, cy + 0.1])
        for c in cs:  # 上下标这类不在这一行基线上、够不着那根探针的字，单独一个点
            if abs(c.base - line_base) > 0.5 or not (c.y0 <= cy <= c.y1):
                entry.probes.append([c.cx - 0.1, c.cy - 0.1, c.cx + 0.1, c.cy + 0.1])
        if mode == "scan":
            cover = _scan_cover(cs, chars, title_ids, entry.protected, pixels)
            entry.covers.append({"rect": cover, "fill": page_ops.surrounding_fill(page, cover)})


def _scan_cover(cs: list[Char], chars: list[Char], title_ids: set[int], protected: list[list[float]], pixels) -> list[float]:
    """扫描件一行标题要盖的框。OCR 的框常比图上的字小（下伸部分、字宽是估的，最后一个字母露在外面），所以：
    先按同一行别的字（章号、点线、页码）、上下行的字、章号标签页码的框定出能盖的范围，再从 OCR 的框起往外找图上
    连着的墨迹（字和字之间的空不超过 0.3 个字），盖到墨迹为止。"""
    size = median(c.size for c in cs)
    base = median(c.base for c in cs)
    first, last = min(c.x0 for c in cs), max(c.x1 for c in cs)
    left, right = first - 0.6 * size, last + 2.0 * size
    top, bottom = base - 1.1 * size, base + 0.45 * size
    others = [c.ink_box() for c in chars if id(c) not in title_ids and not c.c.isspace()]
    for box in others + [list(b) for b in protected]:
        if box[1] >= base + 0.2 * size or box[3] <= base - 0.7 * size:
            continue  # 不在这一行
        if box[2] <= first + 0.5:
            left = max(left, box[2] + 0.5)
        elif box[0] >= last - 0.5:
            right = min(right, box[0] - 0.5)
    for box in others + [list(b) for b in protected]:  # 作者行这类受保护的框在上下行时也收
        if box[2] <= left or box[0] >= right:
            continue
        center = (box[1] + box[3]) / 2
        if center < base - 0.7 * size:  # 上一行的字
            top = max(top, box[3] + 0.3)
        elif center > base + 0.2 * size:  # 下一行的字
            bottom = min(bottom, box[1] - 0.3)
    start = [max(left, first), max(top, base - 0.95 * size), min(right, last), min(bottom, base + 0.28 * size)]
    rect = pixels.grow_to_ink(start, [left, top, right, bottom], gap=0.3 * size) if pixels is not None else start
    return [round(value, 2) for value in rect]


def plan_page(page, page_index: int, entries: list[tuple[dict, dict]], held_ids: set[str], font, *, force_mode: str = "") -> PagePlan:
    """一页：定计划（page 只读）。entries = [(译文条目, metadata)]。force_mode：文字层擦了图上还有字时，整页按扫描件重定。"""
    chars = page_chars(page)
    plans: list[tuple[EntryPlan, list[list[Char]]]] = []
    for item, md in entries:
        box = _box(item.get("bbox")) or [0.0, 0.0, float(page.rect.width), 0.0]
        plans.append(_plan_entry(item, md, chars, font, box))
    title_chars = [c for _entry, line_chars in plans for cs in line_chars for c in cs]
    invisible = sum(1 for c in title_chars if c.invisible)
    # R2 标了文字层看得见、看不见的，按它（多数）；没标就看标题的字有多少是看不见的
    layers = [entry.text_layer for entry, _ in plans if entry.text_layer in ("visible", "invisible")]
    if layers:
        detected = "scan" if layers.count("invisible") * 2 > len(layers) else "text"
    else:
        detected = "scan" if title_chars and invisible >= len(title_chars) * SCAN_INVISIBLE_SHARE else "text"
    mode = force_mode or detected
    pixels = page_ops.PagePixels(page) if mode == "scan" and any(entry.replaced for entry, _ in plans) else None
    for entry, line_chars in plans:
        if entry.replaced:
            _erase_specs(entry, line_chars, chars, mode, page, pixels)
    return PagePlan(page_index=page_index, mode=mode, entries=[entry for entry, _ in plans], held_ids=held_ids)


def _page_items(items: list[dict]) -> tuple[list[dict], set[str]]:
    entries = [item for item in items if isinstance(item, dict) and _role(item) == TOC_ENTRY_ROLE]
    held = {str(item.get("item_id") or "") for item in items if isinstance(item, dict) and _role(item) in (TOC_ENTRY_ROLE, TOC_PAGE_LABEL_ROLE)}
    return entries, held


def plan_toc_replace(
    selected_pages: dict[int, list[dict]],
    *,
    source_pdf_path: Path,
    document_path: Path | None,
    font_path: Path | None,
) -> TocReplacePlan:
    """逐页定计划、在副本上试擦。出错、没有 R0 数据、擦坏了别的字的页退回重排（记在 reflow_pages）。"""
    import fitz

    plan = TocReplacePlan(font_path=font_path)
    pages = {int(index): items for index, items in selected_pages.items() if any(isinstance(i, dict) and _role(i) == TOC_ENTRY_ROLE for i in items or [])}
    if not pages:
        return plan
    if font_path is None:
        plan.reflow_pages = {index: "font_missing" for index in pages}
        return plan
    font = fitz.Font(fontfile=str(font_path))
    blocks = load_document_blocks(document_path)
    with fitz.open(source_pdf_path) as source:
        for index in sorted(pages):
            if index >= len(source):
                plan.reflow_pages[index] = "page_missing"
                continue
            if source[index].rotation:
                plan.reflow_pages[index] = "page_rotated"
                continue
            entry_items, held_ids = _page_items(pages[index])
            entries = [(item, _metadata(item, blocks.get((index, str(item.get("item_id") or ""))))) for item in entry_items]
            if not any(md.get("toc_entry_title_lines") for _item, md in entries):
                plan.reflow_pages[index] = "no_title_lines"
                continue
            try:
                page_plan = _plan_with_trials(source, index, entries, held_ids, font)
            except Exception as exc:  # noqa: BLE001 - 定不了的页照旧重排
                plan.reflow_pages[index] = f"error:{type(exc).__name__}: {exc}"[:300]
                continue
            if isinstance(page_plan, str):
                plan.reflow_pages[index] = page_plan
                continue
            plan.pages[index] = page_plan
    return plan


def _plan_with_trials(source, index: int, entries, held_ids: set[str], font) -> PagePlan | str:
    """在这一页的副本上擦一遍、跑检查。擦坏了别的字（R2）、擦不干净（R1）的条目改成保留原文，再定一遍。"""
    import fitz

    excluded: dict[str, str] = {}
    force_mode = ""
    for _round in range(TRIAL_ROUNDS):
        with fitz.open() as scratch:
            scratch.insert_pdf(source, from_page=index, to_page=index)
            page = scratch[0]
            page_plan = plan_page(page, index, entries, held_ids, font, force_mode=force_mode)
            for entry in page_plan.entries:
                if entry.block_id in excluded:
                    entry.status, entry.lines, entry.probes, entry.covers = excluded[entry.block_id], [], [], []
            report = page_ops.erase_and_check(page, page_plan)
        page_plan.trial = report["summary"]
        failed = {block_id: reason for block_id, reason in report["failed"].items() if block_id not in excluded}
        if not failed:
            return page_plan
        if report["summary"].get("unattributed_lost"):
            return "erase_collateral"
        residual = [block_id for block_id, reason in failed.items() if reason == "kept_erase_residual"]
        if page_plan.mode == "text" and not force_mode and len(residual) * 2 >= max(1, len(page_plan.replaced())):
            force_mode = "scan"  # 字在图上：擦文字层没用，整页按扫描件盖底色
            continue
        excluded.update(failed)
    return "trial_rounds_exhausted"


__all__ = [
    "EntryPlan",
    "HELD_FLAG",
    "LinePlan",
    "PagePlan",
    "TOC_MODE_REFLOW",
    "TOC_MODE_REPLACE",
    "TocReplacePlan",
    "load_document_blocks",
    "plan_page",
    "plan_toc_replace",
]
