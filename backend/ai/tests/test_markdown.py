import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.markdown import (
    chunk_markdown,
    find_markdown_chunk,
    load_markdown_chunks,
    markdown_image_refs,
    markdown_text_for_model,
    search_markdown_chunks,
)


def test_chunk_markdown_preserves_heading_hierarchy_and_stable_ids():
    markdown = """# Paper

Introduction text.

## Results

The conjugated catalyst improves selectivity.
"""
    first = chunk_markdown(markdown)
    second = chunk_markdown(markdown)

    assert [chunk.chunk_id for chunk in first] == ["md-0001", "md-0002"]
    assert [chunk.heading for chunk in first] == ["Paper", "Paper > Results"]
    assert first == second
    assert find_markdown_chunk(first, "MD-0002") == first[1]


def test_chunk_markdown_splits_long_sections_with_bounded_overlap():
    chunks = chunk_markdown(
        "# Long\n\n" + "alpha beta gamma. " * 400,
        max_chars=500,
        overlap_chars=60,
    )

    assert len(chunks) > 2
    assert all(len(chunk.text) <= 500 for chunk in chunks)
    assert all(chunk.heading == "Long" for chunk in chunks)
    assert [chunk.chunk_id for chunk in chunks] == [
        f"md-{index:04d}" for index in range(1, len(chunks) + 1)
    ]


def test_search_markdown_supports_chinese_and_heading_boost():
    chunks = chunk_markdown(
        "# 光谱方法\n\n这里介绍一般背景。\n\n"
        "## 结论\n\n共轭效应显著提高选择性。\n\n"
        "## 附录\n\n选择性一词只在这里重复：选择性、选择性。\n"
    )

    ranked = search_markdown_chunks(chunks, "共轭效应", limit=3)
    assert ranked
    assert ranked[0][0].heading == "光谱方法 > 结论"
    assert search_markdown_chunks(chunks, "不存在的量子术语") == []


def test_load_markdown_chunks_only_reads_full_md(tmp_path):
    job_root = tmp_path / "jobs" / "job-1"
    (job_root / "md").mkdir(parents=True)
    (job_root / "md" / "other.md").write_text("# Wrong\n\nsecret", encoding="utf-8")
    (job_root / "md" / "full.md").write_text("# Right\n\nevidence", encoding="utf-8")

    chunks = load_markdown_chunks(job_root)
    assert len(chunks) == 1
    assert "evidence" in chunks[0].text
    assert "secret" not in chunks[0].text


def test_markdown_images_are_atomic_assets_not_search_evidence():
    markdown = (
        "# Results\n\nThe catalyst improves selectivity.\n\n"
        "![Reaction scheme](images/page-3/imgs/chart a%20中(1).png)\n\n"
        + "tail evidence " * 80
    )
    refs = markdown_image_refs(markdown)
    assert [(ref.alt, ref.path) for ref in refs] == [
        ("Reaction scheme", "images/page-3/imgs/chart a%20中(1).png")
    ]
    assert "chart a%20" not in markdown_text_for_model(markdown)

    chunks = chunk_markdown(markdown, max_chars=420, overlap_chars=40)
    assert sum(len(chunk.images) for chunk in chunks) >= 1
    assert all(not ("![" in chunk.text) ^ (")" in chunk.text) for chunk in chunks)
    assert search_markdown_chunks(chunks, "chart") == []
    assert search_markdown_chunks(chunks, "selectivity")
