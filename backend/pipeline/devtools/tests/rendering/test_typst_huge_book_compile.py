"""超大的书：整本 Typst overlay 编译栈溢出，以及方括号里的 @ 被 cmarker 当成引用（2026-11-03，6574 页的手册）。"""
from __future__ import annotations

import shutil

import pytest

from retainpdf_pipeline.render.output.typst import overlay_chunk_compile as chunks
from retainpdf_pipeline.render.output.typst.block_renderer import sanitize_typst_markdown_for_compile


@pytest.fixture(autouse=True)
def _no_chunk_env(monkeypatch):
    for name in ("RETAIN_TYPST_OVERLAY_CHUNKED", "RETAIN_TYPST_OVERLAY_CHUNK_MIN_PAGES", "RETAIN_TYPST_OVERLAY_CHUNK_PAGES"):
        monkeypatch.delenv(name, raising=False)


def test_huge_books_are_chunked_without_the_switch() -> None:
    # 整本 6574 页 Typst 栈溢出，3287 页能编过：超大的书不等开关自动分片，片切大些
    assert not chunks.should_use_chunked_overlay_compile(chunks.AUTO_CHUNKED_OVERLAY_PAGES - 1)
    assert chunks.should_use_chunked_overlay_compile(6574)
    assert chunks._chunk_page_count(6574) == chunks.AUTO_CHUNK_PAGE_COUNT


def test_the_switch_still_chunks_smaller_books_with_its_own_chunk_size(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TYPST_OVERLAY_CHUNKED", "1")
    assert chunks.should_use_chunked_overlay_compile(chunks.MIN_CHUNKED_OVERLAY_PAGES)
    assert chunks._chunk_page_count(6574) == chunks.DEFAULT_CHUNK_PAGE_COUNT
    monkeypatch.setenv("RETAIN_TYPST_OVERLAY_CHUNK_PAGES", "300")
    assert chunks._chunk_page_count(6574) == 300


@pytest.mark.parametrize(
    ("markdown", "expected"),
    [
        ("以 suspect_name [@input_index] 的格式", r"以 suspect_name [\@input_index] 的格式"),
        ("[ @x; @y]", r"[ \@x; @y]"),
        # 这些 cmarker 本来就不当引用，不动
        ("名称后附加 @PV# 后缀", "名称后附加 @PV# 后缀"),
        ("发邮件到 a@b.com", "发邮件到 a@b.com"),
        ("见 (@y)", "见 (@y)"),
    ],
)
def test_bracketed_at_signs_are_escaped_for_cmarker(markdown: str, expected: str) -> None:
    assert sanitize_typst_markdown_for_compile(markdown) == expected


@pytest.mark.needs_typst
@pytest.mark.skipif(shutil.which("typst") is None, reason="needs the typst binary")
@pytest.mark.parametrize("escaped", [False, True])
def test_cmarker_only_compiles_the_bracketed_at_sign_once_escaped(tmp_path, escaped: bool) -> None:
    # 和 overlay 源码里一样：清理后的 markdown 经 escape_typst_string 写进 Typst 字符串，交给 cmarker
    import subprocess

    from retainpdf_pipeline.render.output.typst.shared import escape_typst_string

    markdown = "以 suspect_name [@input_index] 的格式指定"
    if escaped:
        markdown = sanitize_typst_markdown_for_compile(markdown)
    source = tmp_path / "at-ref.typ"
    source.write_text(
        '#import "@preview/cmarker:0.1.10"\n'
        f'#cmarker.render("{escape_typst_string(markdown)}")\n',
        encoding="utf-8",
    )
    proc = subprocess.run(
        ["typst", "compile", str(source), str(tmp_path / "at-ref.pdf")], capture_output=True, text=True
    )
    if escaped:
        assert proc.returncode == 0, proc.stderr
    else:
        assert proc.returncode != 0 and "input_index" in proc.stderr
