"""从流水线自己渲染出来的译文 PDF 里，把收敛后的字号和行距读回来。

Word 导出此前直接用 `block.font_size_pt` 排字。但那个值是**上界**，不是结果：排版层
把它当作 Typst `pdftr_fit_markdown` 的 `max_size` 交出去，Typst 再用 `measure()` 在
`[fit_min_font_size_pt, font_size_pt]` 里二分，装不下就往下走。所以按上界排版的 Word
文本框，凡是当初被缩过的块都会溢出。

想在 Word 这边重算一遍是走不通的：排版层那个估算器（`capacity.estimated_render_height_pt`）
和真实排版差得很远——在本仓的真实 job 上按字符加权对一遍，用它二分挑出来的字号，平均
绝对误差和「干脆照搬上界」几乎一样（0.402pt vs 0.400pt）。换一套不比原来准的算法，只是
换一种错法。

还有一件事让重算更不可靠：`build_render_page_specs` 重新算出来的结果和当初真正渲染用的
那份并不相等。同一个块，流水线产出的 .typ 里写的是 `size: 10.36pt`，而现在重算一遍得到
10.13pt——当时的排版状态（2026-11-02 删掉的排版记忆 typography_memory 之类）会让两次结果分叉。

所以这里不重算，直接读产物：收敛后的字号就摆在 `rendered/*-translated.pdf` 里，行距也能
从相邻行的基线差量出来。读不到的块（框里没文字、或渲染产物不存在）退回 spec 的值。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from statistics import median

import fitz


@dataclass(frozen=True)
class ConvergedTypography:
    """某个块在译文 PDF 里真正排出来的样子。"""

    font_size_pt: float
    # 相邻两行基线的距离。只观测到一行时为 0.0——此时没有行距可言，调用方退回自己的算法。
    line_step_pt: float


@dataclass(frozen=True)
class _ObservedLine:
    x0: float
    y0: float
    x1: float
    y1: float
    baseline: float
    sizes: tuple[tuple[float, int], ...]

    @property
    def char_count(self) -> int:
        return sum(count for _size, count in self.sizes)


def translated_pdf_path(job_root: Path) -> Path | None:
    """流水线渲染出来的译文 PDF。找不到就返回 None——导出仍然要能跑完。"""
    rendered = job_root / "rendered"
    if not rendered.is_dir():
        return None
    candidates = sorted(rendered.glob("*-translated.pdf")) or sorted(rendered.glob("*.pdf"))
    return candidates[0] if candidates else None


def read_page_lines(document, page_index: int) -> list[_ObservedLine]:
    if page_index < 0 or page_index >= document.page_count:
        return []
    lines: list[_ObservedLine] = []
    for block in document[page_index].get_text("dict")["blocks"]:
        for line in block.get("lines", ()):
            sizes: dict[float, int] = {}
            baseline = 0.0
            for span in line.get("spans", ()):
                count = len(span.get("text", "").strip())
                if count <= 0:
                    continue
                size = round(float(span.get("size") or 0.0), 2)
                if size <= 0:
                    continue
                sizes[size] = sizes.get(size, 0) + count
                baseline = float(span.get("origin", (0.0, 0.0))[1])
            if not sizes:
                continue
            x0, y0, x1, y1 = line.get("bbox", (0.0, 0.0, 0.0, 0.0))
            lines.append(_ObservedLine(
                x0=float(x0), y0=float(y0), x1=float(x1), y1=float(y1),
                baseline=baseline, sizes=tuple(sorted(sizes.items())),
            ))
    return lines


def converged_typography(
    lines: list[_ObservedLine],
    content_rect,
    expected_chars: int,
) -> ConvergedTypography | None:
    """块框里真正排出来的字号与行距。对不上就返回 None，让调用方退回 spec。

    按**行的中心落在框内**来归属，而不是 PyMuPDF 的 `clip=`——`clip` 会把压在框边上的
    邻块文字一起裁进来，之前拿它量出来的「52.7% 的字号和 spec 对不上」就是这么来的假象。
    """
    if len(content_rect) != 4:
        return None
    x0, y0, x1, y1 = (float(v) for v in content_rect)
    inside = [
        line for line in lines
        if x0 - 1.0 <= (line.x0 + line.x1) / 2 <= x1 + 1.0
        and y0 - 1.0 <= (line.y0 + line.y1) / 2 <= y1 + 1.0
    ]
    observed = sum(line.char_count for line in inside)
    if observed <= 0:
        return None
    # 框里读到的字明显少于这个块该有的量，说明这块的文字没排在这儿（或者被归给了别的
    # 行）。宁可退回 spec，也不要拿半个块的观测去定整块的字号。
    if expected_chars > 0 and observed < expected_chars * 0.5:
        return None

    totals: dict[float, int] = {}
    for line in inside:
        for size, count in line.sizes:
            totals[size] = totals.get(size, 0) + count
    font_size_pt = max(totals.items(), key=lambda item: (item[1], item[0]))[0]

    baselines = sorted(line.baseline for line in inside if line.baseline > 0)
    steps = [
        round(b - a, 3) for a, b in zip(baselines, baselines[1:])
        # 同一行被拆成多段时基线差约等于 0；跨栏/跨段的大跳也不是行距。
        if 0.5 < b - a < font_size_pt * 3.0
    ]
    return ConvergedTypography(
        font_size_pt=font_size_pt,
        line_step_pt=round(median(steps), 3) if steps else 0.0,
    )


def open_translated_document(job_root: Path, translated_pdf: Path | None = None):
    # 和源 PDF 同理:调用方解析好了就用它，别在这里靠 job_root 猜。
    path = translated_pdf if translated_pdf and translated_pdf.is_file() else translated_pdf_path(job_root)
    if path is None:
        return None
    try:
        return fitz.open(path)
    except Exception:  # noqa: BLE001 - 产物损坏时导出照样要能跑完，只是退回 spec
        return None
