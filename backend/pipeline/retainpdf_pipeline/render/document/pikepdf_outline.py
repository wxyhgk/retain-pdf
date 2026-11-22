"""书签（PDF outline）从原件抄到只含部分页的输出上（pikepdf，不经 PyMuPDF）。

只输出要渲染的页的路线（rpr_fit 的 typst / typst_visual）先按页抽出底图再叠译文，抽页得到的新 PDF 没有书签。
这里按「输出第几页 ← 原件第几页」把原件的书签抄过去：层级照旧；指向没输出的页的书签去掉，但它下面还有
指向输出页的子书签时留着它（指向第一个留下的子书签那页），免得章节标题丢了、小节散到上一层。
"""

from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

import pikepdf


@dataclass
class _Entry:
    title: str
    target_page: int | None
    children: list["_Entry"] = field(default_factory=list)


def _named_destination(pdf: pikepdf.Pdf, name: object) -> object | None:
    root = pdf.Root
    if isinstance(name, pikepdf.Name) and "/Dests" in root:
        return root.Dests.get(name)
    if isinstance(name, pikepdf.String) and "/Names" in root and "/Dests" in root.Names:
        tree = pikepdf.NameTree(root.Names.Dests)
        return tree.get(str(name))
    return None


def _destination_page(pdf: pikepdf.Pdf, item: pikepdf.OutlineItem, page_index_of: dict[tuple[int, int], int]) -> int | None:
    destination = item.destination
    if destination is None and item.action is not None and item.action.get("/S") == pikepdf.Name.GoTo:
        destination = item.action.get("/D")
    if isinstance(destination, (pikepdf.Name, pikepdf.String)):
        destination = _named_destination(pdf, destination)
    if isinstance(destination, pikepdf.Dictionary):
        destination = destination.get("/D")
    if not isinstance(destination, pikepdf.Array) or len(destination) == 0:
        return None
    target = destination[0]
    if isinstance(target, pikepdf.Dictionary):
        return page_index_of.get(target.objgen)
    try:
        return int(target)
    except (TypeError, ValueError):
        return None


def _remap(
    pdf: pikepdf.Pdf,
    items: list[pikepdf.OutlineItem],
    page_index_of: dict[tuple[int, int], int],
    output_page_of: dict[int, int],
) -> list[_Entry]:
    kept: list[_Entry] = []
    for item in items:
        children = _remap(pdf, list(item.children), page_index_of, output_page_of)
        source_page = _destination_page(pdf, item, page_index_of)
        target = output_page_of.get(source_page) if source_page is not None else None
        if target is None and children:
            target = children[0].target_page
        if target is None:
            kept.extend(children)
            continue
        kept.append(_Entry(title=str(item.title or ""), target_page=target, children=children))
    return kept


def _build(entries: list[_Entry]) -> list[pikepdf.OutlineItem]:
    built: list[pikepdf.OutlineItem] = []
    for entry in entries:
        item = pikepdf.OutlineItem(entry.title, entry.target_page)
        item.children.extend(_build(entry.children))
        built.append(item)
    return built


def _count(entries: list[_Entry]) -> int:
    return sum(1 + _count(entry.children) for entry in entries)


def copy_outline_for_pages(*, source_pdf_path: Path, target_pdf_path: Path, source_page_indices: list[int]) -> int:
    """把 ``source_pdf_path`` 的书签抄到 ``target_pdf_path``（就地改）；输出第 i 页是原件第 ``source_page_indices[i]`` 页（0 起）。

    返回抄过去的书签条数；原件没有书签、或一条都对不上输出页时不动输出文件，返回 0。
    """
    output_page_of = {int(source): offset for offset, source in enumerate(source_page_indices)}
    with pikepdf.Pdf.open(source_pdf_path) as source:
        page_index_of = {page.obj.objgen: index for index, page in enumerate(source.pages)}
        with source.open_outline() as outline:
            entries = _remap(source, list(outline.root), page_index_of, output_page_of)
    if not entries:
        return 0
    with pikepdf.Pdf.open(target_pdf_path, allow_overwriting_input=True) as target:
        page_count = len(target.pages)
        entries = _within(entries, page_count)
        if not entries:
            return 0
        with target.open_outline() as outline:
            outline.root.clear()
            outline.root.extend(_build(entries))
        target.save(
            target_pdf_path,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            compress_streams=True,
            recompress_flate=False,
        )
    return _count(entries)


def _within(entries: list[_Entry], page_count: int) -> list[_Entry]:
    kept: list[_Entry] = []
    for entry in entries:
        children = _within(entry.children, page_count)
        if entry.target_page is not None and 0 <= entry.target_page < page_count:
            kept.append(_Entry(entry.title, entry.target_page, children))
        else:
            kept.extend(children)
    return kept


__all__ = ["copy_outline_for_pages"]
