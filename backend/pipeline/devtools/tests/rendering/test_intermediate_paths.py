"""Regression for issue #79: long paper titles must not blow Windows MAX_PATH."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.render.source.intermediate_paths import intermediate_pdf_path


def test_short_stem_keeps_readable_name(tmp_path: Path) -> None:
    out = tmp_path / "paper.pdf"
    path = intermediate_pdf_path(
        work_root=tmp_path / "work",
        output_pdf_path=out,
        suffix=".source-bbox-text-stripped.pdf",
    )
    assert path.name == "paper.source-bbox-text-stripped.pdf"
    assert path.parent == tmp_path / "work"


def test_long_stem_uses_hash_when_full_path_too_long(tmp_path: Path, monkeypatch) -> None:
    # Simulate a deep job tree + long paper title (issue #79 Windows MAX_PATH).
    deep = (
        tmp_path
        / "Users"
        / "XXXXXX"
        / "AppData"
        / "Roaming"
        / "retain-pdf-desktop"
        / "data"
        / "jobs"
        / "20260715015829-a90a1f"
        / "artifacts"
        / "render_prewarm"
    )
    deep.mkdir(parents=True, exist_ok=True)
    long_title = (
        "Jabbar 等 - 2026 - TransKla A Local-Global Cross-Attention Based "
        "Transformer Approach for Prediction of Lysine Lactyla-translated.pdf"
    )
    out = deep / long_title

    # Tighten full-path budget so preferred long name is rejected on any OS.
    monkeypatch.setattr(
        "retainpdf_pipeline.render.source.intermediate_paths._SAFE_FULL_PATH_BYTES_POSIX",
        200,
    )
    monkeypatch.setattr(
        "retainpdf_pipeline.render.source.intermediate_paths._SAFE_FULL_PATH_BYTES_WINDOWS",
        200,
    )

    preferred = deep / f"{out.stem}.source-bbox-text-stripped.pdf"
    assert len(str(preferred)) > 200  # would blow MAX_PATH-style limit

    path = intermediate_pdf_path(
        work_root=deep,
        output_pdf_path=out,
        suffix=".source-bbox-text-stripped.pdf",
    )
    assert path.parent == deep
    assert "Jabbar" not in path.name
    assert path.name.endswith(".source-bbox-text-stripped.pdf") or path.name.endswith(".pdf")
    assert len(str(path)) < len(str(preferred))


def test_filename_component_over_limit_uses_hash(tmp_path: Path) -> None:
    work = tmp_path / "w"
    work.mkdir()
    huge_stem = "A" * 300
    path = intermediate_pdf_path(
        work_root=work,
        output_pdf_path=work / f"{huge_stem}.pdf",
        suffix=".source-hidden-text-stripped.pdf",
    )
    assert path.parent == work
    assert len(path.name.encode("utf-8")) < 80
