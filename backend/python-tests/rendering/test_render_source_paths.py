from __future__ import annotations

import os
from pathlib import Path

import pikepdf

from services.rendering.source.render_source import build_render_source_pdf


def test_render_source_accepts_output_name_near_filesystem_limit(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    with pikepdf.Pdf.new() as pdf:
        pdf.add_blank_page(page_size=(100, 100))
        pdf.save(source_pdf)

    pathconf = getattr(os, "pathconf", None)
    name_max = int(pathconf(tmp_path, "PC_NAME_MAX")) if pathconf is not None else 255
    output_stem = "a" * (name_max - len(".pdf"))
    output_pdf = tmp_path / f"{output_stem}.pdf"
    derived_name = f"{output_pdf.stem}.source-xobject-sanitized.pdf"
    assert len(os.fsencode(derived_name)) > name_max

    result = build_render_source_pdf(
        source_pdf_path=source_pdf,
        output_pdf_path=output_pdf,
        pdf_compress_dpi=0,
        strip_hidden_text=False,
        artifact_mode=True,
    )

    assert result.path == source_pdf
