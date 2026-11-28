"""目录原位替换：正文排完以后，在译文 PDF 上照计划（``plan.py``）擦标题的字、在原位置写译文。

和表格那一遍（``render/output/tables/overlay.py``）同一个做法：

1. 译文 PDF 上这一页：按计划打探针擦标题的字（扫描件在图上盖底色），跑一遍检查（``page_ops.erase_and_check``）；
2. 译文另画在一个小 PDF 上（每页一页，和正文同一份字体，嵌子集），叠到译文 PDF 那一页上；
3. 这次有阅读页的版面（rpr_fit 排的），擦的框和写的字补进版面（``rpr_fit/reader_layout.py`` 的
   ``add_reader_layout_toc``），阅读页的 HTML 页和 PDF 一样。

出错只记一笔，照常交出排好的 PDF（目录条目那时还是原文）。
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from retainpdf_pipeline.render.output.tables.overlay import output_page_indices
from retainpdf_pipeline.render.output.toc_replace import page_ops
from retainpdf_pipeline.render.output.toc_replace.plan import TocReplacePlan
from retainpdf_pipeline.render.output.toc_replace.text import has_cjk

FONT_NAME = "rpdftoc"
# 各页检查结果加起来的项
_TOTAL_KEYS = (
    "entries", "R1_title_chars_left", "R1_residual_ink_lines", "R1_ring_ink_strips", "R2_other_chars_lost", "R2_cover_hits",
    "R3_overlap_chars", "R4_placed", "R4_shrunk", "R4_kept_does_not_fit", "R5_too_many_lines", "R5_multiline", "R5_empty_lines",
    "R6_page_line_eligible", "R6_on_page_line", "R6_numbered_from_top", "R7_text_mismatch", "R8_markup",
)


def _overlay_document(pages: list[tuple[float, float, list]], font_path: Path):
    """每页一页的小 PDF，只有译文的字（黑色、常规体），字体嵌子集。"""
    import fitz

    font = fitz.Font(fontfile=str(font_path))
    mini = fitz.open()
    for width, height, entries in pages:
        page = mini.new_page(width=width, height=height)
        for entry in entries:
            for line in entry.lines:
                for x, text in line_runs(line, font):
                    page.insert_text((x, line.baseline), text, fontname=FONT_NAME, fontfile=str(font_path),
                                     fontsize=line.size, color=(0, 0, 0))
    mini.subset_fonts()
    data = mini.tobytes(garbage=3, deflate=True)
    mini.close()
    return fitz.open("pdf", data)


def line_runs(line, font) -> list[tuple[float, str]]:
    """一行拆成几段连着画的字：字和字之间多出空（汉字和西文之间的 1/4 个字）的地方另起一段，每段画在第一个字的 x 上。"""
    runs: list[tuple[float, str]] = []
    expected = None
    for x, ch in line.items:
        if runs and expected is not None and abs(x - expected) < 0.01:
            runs[-1] = (runs[-1][0], runs[-1][1] + ch)
        else:
            runs.append((x, ch))
        expected = x + font.text_length(ch, fontsize=line.size)
    return [(x, text) for x, text in runs if text.strip()]


def reader_blocks(entries: list) -> list[dict]:
    """阅读页版面里的块（和引擎写的 ``rpr_layout_v1`` 的块一样：一行一组字簇，每个字簇画在它的 x 上）。"""
    blocks = []
    for entry in entries:
        lines = []
        for line in entry.lines:
            dflt = not has_cjk(line.text)
            items = []
            for x, text in line.items:
                item = {"x": x, "t": text}
                if dflt:
                    item["mode"] = "dflt"
                items.append(item)
            lines.append({"text": line.text, "x": line.x, "baseline": line.baseline, "width": round(line.width, 3),
                          "justified": False, "items": items})
        blocks.append({"id": entry.block_id, "fontSize": round(entry.size * entry.scale, 3), "weight": "regular",
                       "color": [0, 0, 0], "lines": lines})
    return blocks


def _totals(pages: dict[str, dict]) -> dict:
    totals = {key: sum(int(page.get(key) or 0) for page in pages.values()) for key in _TOTAL_KEYS}
    scales = [page["R4_min_scale"] for page in pages.values() if page.get("R4_min_scale") is not None]
    totals["R4_min_scale"] = min(scales) if scales else None
    return totals


def apply_toc_replace(
    *,
    output_pdf_path: Path,
    source_pdf_path: Path,
    plan: TocReplacePlan,
    page_indices,
    original_pdf_path: Path | None = None,
    font_dirs: list[Path] | None = None,
) -> dict:
    """照计划换目录标题。返回写进渲染诊断的 ``toc_replace``：计划（各状态条数、退回重排的页、留给模型看的条目）、
    每页检查结果和合计。"""
    import fitz

    result = plan.diagnostics()
    if not plan.pages or plan.font_path is None:
        result["skipped"] = "no_pages"
        return result
    output_pdf_path = Path(output_pdf_path)
    with fitz.open(source_pdf_path) as source:
        source_count = len(source)
    checks: dict[str, dict] = {}
    placed_ids: dict[str, list[str]] = {}
    placements: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="toc-replace-", dir=str(output_pdf_path.parent)) as work:
        temp_pdf = Path(work) / "with-toc.pdf"
        with fitz.open(output_pdf_path) as doc:
            mapping = output_page_indices(source_count, len(doc), page_indices)
            targets = []
            for index, page_plan in sorted(plan.pages.items()):
                if index not in mapping or mapping[index] >= len(doc):
                    checks[str(index)] = {"skipped": "page_not_rendered"}
                    continue
                page = doc[mapping[index]]
                report = page_ops.erase_and_check(page, page_plan)
                checks[str(index)] = {**report["summary"], "failed_entries": report["failed"]}
                entries = page_plan.replaced()
                placed_ids[str(index)] = [entry.block_id for entry in entries]
                targets.append((page, entries))
                placements.append({"page_index": index, "blocks": reader_blocks(entries), "erase": _erase_rects(entries)})
            if targets:
                overlay = _overlay_document([(page.rect.width, page.rect.height, entries) for page, entries in targets], plan.font_path)
                try:
                    for offset, (page, _entries) in enumerate(targets):
                        page.show_pdf_page(page.rect, overlay, offset, overlay=True)
                finally:
                    overlay.close()
                doc.save(str(temp_pdf), garbage=3, deflate=True)
        if targets:
            os.replace(temp_pdf, output_pdf_path)
    result["checks"] = checks
    result["placed_ids"] = placed_ids
    result["totals"] = _totals({key: value for key, value in checks.items() if "skipped" not in value})
    if placements:
        result["reader_layout"] = _add_to_reader_layout(
            output_pdf_path, original_pdf_path or Path(source_pdf_path), placements, font_dirs, plan.font_path
        )
    return result


def _erase_rects(entries: list) -> list[dict]:
    """阅读页拿原文页做底：标题的字先盖掉（文字层的按字框，往外放一点；扫描件就是盖的框），底色到补版面时再取。"""
    rects = []
    for entry in entries:
        if entry.erase == "cover":
            rects.extend({"rect": cover["rect"], "fill": cover["fill"]} for cover in entry.covers)
        else:
            rects.extend({"rect": [rect[0] - 0.3, rect[1] - 0.3, rect[2] + 0.3, rect[3] + 0.3], "fill": None} for rect in entry.title_rects)
    return rects


def _add_to_reader_layout(output_pdf_path: Path, original_pdf_path: Path, placements: list[dict], font_dirs, font_file) -> dict:
    from retainpdf_pipeline.render.output.rpr_fit.reader_layout import add_reader_layout_toc

    try:
        return add_reader_layout_toc(
            output_pdf_path=output_pdf_path,
            placements=placements,
            original_pdf_path=original_pdf_path,
            font_dirs=list(font_dirs or []),
            font_file=font_file,
        )
    except Exception as exc:  # noqa: BLE001 — 版面是附带产物，坏了不连累译文
        print(f"toc replace: reader layout not updated: {type(exc).__name__}: {exc}", flush=True)
        return {"error": f"{type(exc).__name__}: {exc}"[:500]}


__all__ = ["apply_toc_replace", "line_runs", "reader_blocks"]
