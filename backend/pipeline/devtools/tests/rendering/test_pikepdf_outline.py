"""书签按页抄到只含部分页的输出上（render/document/pikepdf_outline.py，#146）。"""

from __future__ import annotations

from pathlib import Path

import fitz
import pikepdf

from retainpdf_pipeline.render.document.pikepdf_outline import copy_outline_for_pages


def _pdf(path: Path, pages: int, toc: list[list] | None = None) -> Path:
    doc = fitz.open()
    for index in range(pages):
        doc.new_page(width=200, height=200).insert_text((20, 50), f"page {index}")
    if toc:
        doc.set_toc(toc)
    doc.save(path)
    doc.close()
    return path


def _toc(path: Path) -> list[list]:
    with fitz.open(path) as doc:
        return doc.get_toc()


def test_bookmarks_follow_their_pages_and_keep_their_levels(tmp_path: Path) -> None:
    source = _pdf(tmp_path / "source.pdf", 6, [
        [1, "Part I", 1],
        [2, "Chapter 1", 2],
        [2, "Chapter 2", 4],
        [3, "Section 2.1", 5],
        [1, "Index", 6],
    ])
    # 输出只有原件第 2、4、5 页（0 起：1、3、4）
    target = _pdf(tmp_path / "target.pdf", 3)
    assert copy_outline_for_pages(source_pdf_path=source, target_pdf_path=target, source_page_indices=[1, 3, 4]) == 4
    assert _toc(target) == [
        # Part I 那页没输出，但它下面还有章：留着，指向第一章那页
        [1, "Part I", 1],
        [2, "Chapter 1", 1],
        [2, "Chapter 2", 2],
        [3, "Section 2.1", 3],
        # Index 那页没输出、也没有子书签：去掉
    ]


def test_named_destinations_are_resolved(tmp_path: Path) -> None:
    source = _pdf(tmp_path / "source.pdf", 3)
    with pikepdf.Pdf.open(source, allow_overwriting_input=True) as pdf:
        pdf.Root.Names = pikepdf.Dictionary(Dests=pikepdf.Dictionary(Names=pikepdf.Array([
            pikepdf.String("ch3"), pikepdf.Array([pdf.pages[2].obj, pikepdf.Name.Fit]),
        ])))
        with pdf.open_outline() as outline:
            outline.root.append(pikepdf.OutlineItem("Named", pikepdf.String("ch3")))
        pdf.save(source)
    target = _pdf(tmp_path / "target.pdf", 2)
    assert copy_outline_for_pages(source_pdf_path=source, target_pdf_path=target, source_page_indices=[0, 2]) == 1
    assert _toc(target) == [[1, "Named", 2]]


def test_nothing_to_copy_leaves_the_output_alone(tmp_path: Path) -> None:
    source = _pdf(tmp_path / "source.pdf", 3)
    target = _pdf(tmp_path / "target.pdf", 2)
    before = target.read_bytes()
    assert copy_outline_for_pages(source_pdf_path=source, target_pdf_path=target, source_page_indices=[0, 1]) == 0
    assert target.read_bytes() == before
