"""目录原位替换：在一页上擦字、跑检查（R1–R9，docs/ops/planning/toc-agent/ 的 R1 记录第 3 节）。

定计划时在原文页的副本上试一遍（``plan.py``），排完正文后在译文 PDF 上真做一遍（``apply.py``），两边都是这一份代码。

| 检查 | 量什么 |
|---|---|
| R1 标题擦干净 | 文字层：标题的字擦完还剩几个；看图：标题框里还有没有墨迹（看不见的文字层擦了也没用）。扫描件：盖的框外沿一圈有没有没盖住的墨迹 |
| R2 别的没擦掉 | 文字层：标题以外的字擦前擦后一个不少；扫描件：盖的框压没压到章号、标签、页码、点线和别的字 |
| R3 不压字 | 新写的每一行的框里没有留下来的字 |
| R4 放下了 | 原字号放下 / 缩了字号（最小倍数）/ 放不下保留原文 |
| R5 行数 | 用的行不多于原文的行 |
| R6 和页码同行 | 页码在末行、用不完原来的行时，放到了页码那一行的条数 |
| R7 字一个不少 | 写出来的字（去空白）和译文标题一样 |
| R8 没漏标记 | 写出来的字里没有 ``$``、HTML 标签、Markdown 标记 |
| R9 空当 | 标题末尾到点线或页码的距离（字），原文和译文的中位数，只记数 |
"""

from __future__ import annotations

from collections import Counter

from retainpdf_pipeline.render.output.toc_replace.text import MARKUP_RE
from retainpdf_pipeline.render.output.toc_replace.text import CharIndex
from retainpdf_pipeline.render.output.toc_replace.text import median
from retainpdf_pipeline.render.output.toc_replace.text import page_chars
from retainpdf_pipeline.render.output.toc_replace.text import squash

SAMPLE_SCALE = 2.0
# 一个像素和底色任一通道差过这么多算墨迹
INK_LEVEL = 80
# 标题框里墨迹超过这个比例算没擦干净（下划线这类细线不到 2%）
RESIDUAL_INK_RATIO = 0.03
# 扫描件盖的框外沿一圈（pt）：墨迹超过这个比例算字没盖全
RING_PT = 1.2
RING_INK_RATIO = 0.08
# 扫描件：盖的框压到别的字的面积占那个字的这么多算压到
COVER_HIT_RATIO = 0.2


def _rect(values):
    import fitz

    return fitz.Rect(*values)


def _pixmap(page, rect):
    import fitz

    clip = _rect(rect) & page.rect
    if clip.is_empty or clip.width < 0.5 or clip.height < 0.5:
        return None
    return page.get_pixmap(matrix=fitz.Matrix(SAMPLE_SCALE, SAMPLE_SCALE), clip=clip, colorspace=fitz.csRGB, alpha=False)


def _dominant(pixmap) -> tuple[int, int, int]:
    samples, n = pixmap.samples, pixmap.n
    bins: Counter = Counter()
    sums: dict[tuple[int, int, int], list[int]] = {}
    for offset in range(0, len(samples) - n + 1, n):
        r, g, b = samples[offset], samples[offset + 1], samples[offset + 2]
        key = (r >> 4, g >> 4, b >> 4)
        bins[key] += 1
        total = sums.setdefault(key, [0, 0, 0])
        total[0] += r
        total[1] += g
        total[2] += b
    if not bins:
        return (255, 255, 255)
    key, count = bins.most_common(1)[0]
    return tuple(round(value / count) for value in sums[key])  # type: ignore[return-value]


def surrounding_fill(page, rect: list[float], margin: float = 3.0) -> list[float]:
    """这一行周围最多的颜色（扫描件盖字用的底色），0–1。"""
    pixmap = _pixmap(page, [rect[0] - margin, rect[1] - margin, rect[2] + margin, rect[3] + margin])
    if pixmap is None:
        return [1.0, 1.0, 1.0]
    return [round(value / 255, 3) for value in _dominant(pixmap)]


class PagePixels:
    """整页画一次（2 倍），找墨迹用：扫描件盖字的框按图上连着的墨迹往外长。"""

    def __init__(self, page) -> None:
        import fitz

        pixmap = page.get_pixmap(matrix=fitz.Matrix(SAMPLE_SCALE, SAMPLE_SCALE), colorspace=fitz.csRGB, alpha=False)
        self.width, self.height, self.n = pixmap.width, pixmap.height, pixmap.n
        self.samples = pixmap.samples
        self.stride = pixmap.stride

    def _ink(self, x: int, y: int, bg) -> bool:
        offset = y * self.stride + x * self.n
        s = self.samples
        return max(abs(s[offset] - bg[0]), abs(s[offset + 1] - bg[1]), abs(s[offset + 2] - bg[2])) > INK_LEVEL

    def _px(self, value: float, size: int) -> int:
        return max(0, min(size - 1, int(round(value * SAMPLE_SCALE))))

    def background(self, rect) -> tuple[int, int, int]:
        x0, y0, x1, y1 = (self._px(rect[0], self.width), self._px(rect[1], self.height), self._px(rect[2], self.width), self._px(rect[3], self.height))
        bins: Counter = Counter()
        for y in range(y0, y1 + 1, 2):
            for x in range(x0, x1 + 1, 2):
                offset = y * self.stride + x * self.n
                bins[(self.samples[offset] >> 4, self.samples[offset + 1] >> 4, self.samples[offset + 2] >> 4)] += 1
        if not bins:
            return (255, 255, 255)
        key = bins.most_common(1)[0][0]
        return (key[0] * 16 + 8, key[1] * 16 + 8, key[2] * 16 + 8)

    def grow_to_ink(self, start: list[float], limit: list[float], *, gap: float) -> list[float]:
        """从 start 起往左右、上下长，直到连着的墨迹到头（左右可以跳过不超过 gap 的空），不超出 limit。"""
        bg = self.background(limit)
        lx0, ly0, lx1, ly1 = (self._px(limit[0], self.width), self._px(limit[1], self.height), self._px(limit[2], self.width), self._px(limit[3], self.height))
        x0, y0, x1, y1 = (self._px(start[0], self.width), self._px(start[1], self.height), self._px(start[2], self.width), self._px(start[3], self.height))
        gap_px = max(1, int(gap * SAMPLE_SCALE))

        def column(x: int) -> bool:
            return any(self._ink(x, y, bg) for y in range(y0, y1 + 1))

        def row(y: int) -> bool:
            return any(self._ink(x, y, bg) for x in range(x0, x1 + 1))

        for step, edge, stop in ((1, x1, lx1), (-1, x0, lx0)):
            x, empty, reach = edge, 0, edge
            while x != stop:
                x += step
                if column(x):
                    reach, empty = x, 0
                else:
                    empty += 1
                    if empty > gap_px:
                        break
            if step == 1:
                x1 = reach
            else:
                x0 = reach
        for step, edge, stop in ((1, y1, ly1), (-1, y0, ly0)):
            y, reach = edge, edge
            while y != stop:
                y += step
                if not row(y):
                    break
                reach = y
            if step == 1:
                y1 = reach
            else:
                y0 = reach
        pad = 0.5  # 盖住字边的半个像素
        return [max(limit[0], x0 / SAMPLE_SCALE - pad), max(limit[1], y0 / SAMPLE_SCALE - pad),
                min(limit[2], (x1 + 1) / SAMPLE_SCALE + pad), min(limit[3], (y1 + 1) / SAMPLE_SCALE + pad)]


def ink_ratio(page, rect, background: tuple[int, int, int] | None = None) -> float:
    pixmap = _pixmap(page, rect)
    if pixmap is None:
        return 0.0
    bg = background or _dominant(pixmap)
    samples, n = pixmap.samples, pixmap.n
    total = ink = 0
    for offset in range(0, len(samples) - n + 1, n):
        total += 1
        if max(abs(samples[offset] - bg[0]), abs(samples[offset + 1] - bg[1]), abs(samples[offset + 2] - bg[2])) > INK_LEVEL:
            ink += 1
    return ink / total if total else 0.0


def _overlap_share(box, rect) -> float:
    width = min(box[2], rect[2]) - max(box[0], rect[0])
    height = min(box[3], rect[3]) - max(box[1], rect[1])
    area = max((box[2] - box[0]) * (box[3] - box[1]), 1e-6)
    return width * height / area if width > 0 and height > 0 else 0.0


def erase(page, page_plan) -> None:
    """只擦计划里要换的条目：探针碰到的字（PyMuPDF 只删碰到探针的字，同一条绘字指令里的点线、页码留着）；
    扫描件再在图上盖底色。"""
    import fitz

    replaced = page_plan.replaced()
    probes = [probe for entry in replaced for probe in entry.probes]
    for probe in probes:
        page.add_redact_annot(_rect(probe), fill=False)
    if probes:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)
    for entry in replaced:
        for cover in entry.covers:
            page.draw_rect(_rect(cover["rect"]), color=None, fill=tuple(cover["fill"]), width=0, overlay=True)


def _ring(rect: list[float]) -> list[list[float]]:
    x0, y0, x1, y1 = rect
    return [[x0, y0 - RING_PT, x1, y0], [x0, y1, x1, y1 + RING_PT], [x0 - RING_PT, y0, x0, y1], [x1, y0, x1 + RING_PT, y1]]


def erase_and_check(page, page_plan) -> dict:
    """擦（``erase``），跑 R1–R3、R5–R9；R4 在计划里。返回 {summary, failed: {块号: 改成的状态}, entries}。"""
    replaced = page_plan.replaced()
    before = page_chars(page)
    all_title = CharIndex(key for entry in replaced for key in entry.title_keys)
    # 标题以外的字（R2 要一个不少；扫描件看盖的框压没压到它们）
    other_chars = [c for c in before if not c.c.isspace() and not all_title.has(c.key())]
    erase(page, page_plan)
    after = page_chars(page)
    after_index = CharIndex(c.key() for c in after if not c.c.isspace())
    lost = Counter(c.key() for c in other_chars if not after_index.has(c.key()))
    failed: dict[str, str] = {}
    per_entry: dict[str, dict] = {}
    residual_text = residual_ink = cover_hits = ring_ink = overlap = 0
    for entry in replaced:
        stats: dict = {}
        left = sum(1 for key in entry.title_keys if after_index.has(key))
        stats["title_chars_left"] = left
        residual_text += left
        if entry.erase == "chars":
            inked = [rect for rect in entry.title_rects if ink_ratio(page, [rect[0] + 0.3, rect[1] + 0.3, rect[2] - 0.3, rect[3] - 0.3]) > RESIDUAL_INK_RATIO]
            stats["residual_ink_lines"] = len(inked)
            residual_ink += len(inked)
            if inked or left:
                failed[entry.block_id] = "kept_erase_residual"
        else:
            hits = 0
            for cover in entry.covers:
                rect = cover["rect"]
                hits += sum(1 for c in other_chars if _overlap_share(c.ink_box(), rect) > COVER_HIT_RATIO)
                hits += sum(1 for box in entry.protected if _overlap_share(box, rect) > COVER_HIT_RATIO)
            stats["cover_hits"] = hits
            cover_hits += hits
            fills = [tuple(round(v * 255) for v in cover["fill"]) for cover in entry.covers]
            ring = 0
            for cover, fill in zip(entry.covers, fills):
                strips = [strip for strip in _ring(cover["rect"])
                          if not any(_overlap_share(c.ink_box(), strip) > 0 for c in other_chars)]
                ring += sum(1 for strip in strips if ink_ratio(page, strip, fill) > RING_INK_RATIO)
            stats["ring_ink_strips"] = ring
            ring_ink += ring
            if hits:
                failed[entry.block_id] = "kept_erase_collateral"
            elif ring:
                failed[entry.block_id] = "kept_erase_residual"
        # R3：新写的行压没压到留下来的字
        remaining = [c for c in after if not c.c.isspace()]
        hit = sum(1 for line in entry.lines for c in remaining
                  if line.rect()[0] <= c.cx <= line.rect()[2] and line.rect()[1] <= c.cy <= line.rect()[3])
        stats["overlap_chars"] = hit
        overlap += hit
        if hit and entry.block_id not in failed:
            failed[entry.block_id] = "kept_overlap"
        per_entry[entry.block_id] = stats
    # R2（文字层）：丢了的字算到同一行上的条目头上；算不到谁头上的整页退回
    unattributed = 0
    for key, count in lost.items():
        _char, _x0, base = key
        owner = next((entry for entry in replaced for rect in entry.title_rects if rect[1] - 1 <= base <= rect[3] + 1), None)
        if owner is None:
            unattributed += count
        else:
            failed.setdefault(owner.block_id, "kept_erase_collateral")
            per_entry[owner.block_id]["others_lost"] = per_entry[owner.block_id].get("others_lost", 0) + count
    summary = _summary(page_plan, replaced)
    summary.update(
        {
            "mode": page_plan.mode,
            "R1_title_chars_left": residual_text,
            "R1_residual_ink_lines": residual_ink,
            "R1_ring_ink_strips": ring_ink,
            "R2_other_chars_lost": sum(lost.values()),
            "R2_cover_hits": cover_hits,
            "R3_overlap_chars": overlap,
            "other_chars": len(other_chars),
            "unattributed_lost": unattributed,
            "failed": len(failed),
        }
    )
    return {"summary": summary, "failed": failed, "entries": per_entry}


def _summary(page_plan, replaced) -> dict:
    statuses = Counter(entry.status for entry in page_plan.entries)
    scales = [entry.scale for entry in replaced if entry.status == "shrunk"]
    multi = [entry for entry in replaced if entry.src_lines > 1]
    eligible = [entry for entry in multi if entry.page_on_last_line and len(entry.lines) < entry.src_lines]
    gaps_src = [entry.gap_src_em for entry in replaced if entry.gap_src_em is not None]
    gaps_new = [entry.gap_new_em for entry in replaced if entry.gap_new_em is not None]
    return {
        "entries": len(page_plan.entries),
        "statuses": dict(statuses),
        "R4_placed": statuses.get("placed", 0),
        "R4_shrunk": len(scales),
        "R4_min_scale": round(min(scales), 3) if scales else None,
        "R4_kept_does_not_fit": statuses.get("kept_does_not_fit", 0),
        "R5_too_many_lines": sum(1 for entry in replaced if len(entry.lines) > entry.src_lines),
        "R5_multiline": len(multi),
        "R5_empty_lines": sum(entry.src_lines - len(entry.lines) for entry in multi),
        "R6_page_line_eligible": sum(1 for entry in eligible if not entry.has_number),
        "R6_on_page_line": sum(1 for entry in eligible if entry.on_page_line),
        "R6_numbered_from_top": sum(1 for entry in eligible if entry.has_number),
        "R7_text_mismatch": sum(1 for entry in replaced if squash("".join(line.text for line in entry.lines)) != squash(entry.title)),
        "R8_markup": sum(1 for entry in replaced if any(MARKUP_RE.search(line.text) for line in entry.lines)),
        "R9_gap_src_em": round(median(gaps_src), 2) if gaps_src else None,
        "R9_gap_new_em": round(median(gaps_new), 2) if gaps_new else None,
    }


__all__ = ["PagePixels", "erase", "erase_and_check", "ink_ratio", "surrounding_fill"]
