"""通读员的样张（2026-11-20）：跳过目录、致谢、版权、书后的注释索引，长的书从正文三处取。以前从第一段连取 6000 字，
出版社的书取到的常是版权页、目录、致谢。"""

from __future__ import annotations

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent.reader import body_paragraphs
from retainpdf_translation_agent.reader import sample_text


def _page(label: str, *blocks: tuple[str, str]) -> PageInput:
    return PageInput(page_label=label, blocks=[BlockInput(f"{label}-{i}", cls, text, True) for i, (cls, text) in enumerate(blocks)])


def _book() -> list[PageInput]:
    body = [_page(str(10 + i), ("paragraph", f"Body paragraph {i}. " + "The fieldworker waited outside the gate for an answer. " * 12)) for i in range(40)]
    return [
        _page("1", ("paragraph", "THE INTERLOPER"), ("paragraph", "Copyright © 2024 by Princeton University Press. All rights reserved. ISBN 978-0-691")),
        _page("2", ("section_heading", "Contents"), ("paragraph", "Introduction 1 Chapter One 23 Notes 170")),
        _page("3", ("section_heading", "Acknowledgments"), ("paragraph", "I thank my colleagues at length for their generous help over many years. " * 6)),
        _page("4", ("section_heading", "Introduction")),
        *body,
        _page("90", ("section_heading", "Notes"), ("section_heading", "Introduction"), ("paragraph", "1. Keenan 2013, xxiv. " * 30)),
        _page("95", ("section_heading", "Index"), ("paragraph", "access, 49-50; Keenan, Marie, 92 " * 30)),
    ]


def test_side_matter_and_back_matter_are_left_out_of_the_sample() -> None:
    paragraphs = body_paragraphs(_book())
    assert paragraphs[0].startswith("THE INTERLOPER") and len(paragraphs) == 41, "书名页短行留着，由样张跳过；版权、目录、致谢、注释、索引都不要"
    assert not any("Keenan" in p or "Copyright" in p or "colleagues" in p for p in paragraphs)


def test_a_long_book_is_sampled_from_three_spots_in_the_body() -> None:
    sample = sample_text(_book(), limit=3000)
    spots = sample.split("\n\n……\n\n")
    assert len(spots) == 3
    starts = [int(spot.split("Body paragraph ")[1].split(".")[0]) for spot in spots]
    assert starts == sorted(starts) and starts[0] > 0 and starts[-1] >= 25, starts
    assert "THE INTERLOPER" not in sample and "Copyright" not in sample


def test_a_short_paper_is_sampled_from_the_start() -> None:
    paper = [_page("1", ("paragraph", "ABSTRACT: We study charge regulation in the electrical double layer of interacting surfaces. " * 4))]
    assert sample_text(paper).startswith("ABSTRACT: We study") and "……" not in sample_text(paper)
