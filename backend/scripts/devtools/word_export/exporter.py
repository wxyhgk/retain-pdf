from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.shared import Pt

from backend.scripts.devtools.word_export.backgrounds import render_page_backgrounds
from backend.scripts.devtools.word_export.document_builder import add_background_image
from backend.scripts.devtools.word_export.document_builder import add_page_break
from backend.scripts.devtools.word_export.document_builder import set_section_page
from backend.scripts.devtools.word_export.job_io import single_pdf
from backend.scripts.devtools.word_export.job_io import translated_pages
from backend.scripts.devtools.word_export.paths import SCRIPTS_ROOT  # noqa: F401
from backend.scripts.devtools.word_export.textboxes import append_absolute_textbox
from services.rendering.layout.page_specs import build_render_page_specs


def export_layout_docx(
    *,
    job_root: Path,
    output_path: Path,
    dpi: int,
    max_pages: int = 0,
    font_family: str = "SimSun",
) -> Path:
    source_pdf_path = single_pdf(job_root / "source")
    pages = translated_pages(job_root)
    page_specs = build_render_page_specs(source_pdf_path=source_pdf_path, translated_pages=pages)
    if max_pages > 0:
        page_specs = page_specs[:max_pages]

    rendered_dir = job_root / "rendered" / "docx"
    bg_paths = render_page_backgrounds(source_pdf_path, rendered_dir / "background-pages", dpi=dpi)

    document = Document()
    if page_specs:
        set_section_page(
            document.sections[0],
            width_pt=page_specs[0].page_width_pt,
            height_pt=page_specs[0].page_height_pt,
        )

    for spec_index, spec in enumerate(page_specs):
        if spec_index > 0:
            document.add_section(WD_SECTION.NEW_PAGE)
            set_section_page(
                document.sections[-1],
                width_pt=spec.page_width_pt,
                height_pt=spec.page_height_pt,
            )

        add_background_image(
            document,
            bg_paths[spec.page_index],
            width_pt=spec.page_width_pt,
            height_pt=spec.page_height_pt,
        )

        overlay_paragraph = document.add_paragraph()
        overlay_paragraph.paragraph_format.space_before = Pt(0)
        overlay_paragraph.paragraph_format.space_after = Pt(0)
        textbox_shapetype_added = False
        for block_index, block in enumerate(spec.blocks):
            if not block.plain_text.strip():
                continue
            x0, y0, x1, y1 = block.content_rect
            append_absolute_textbox(
                overlay_paragraph,
                shape_id=f"pdftr_p{spec.page_index + 1:03d}_b{block_index:03d}",
                text=block.content_text,
                x_pt=x0,
                y_pt=y0,
                width_pt=max(8.0, x1 - x0),
                height_pt=max(8.0, y1 - y0),
                font_size_pt=block.font_size_pt,
                font_family=font_family,
                include_shapetype=not textbox_shapetype_added,
            )
            textbox_shapetype_added = True

        if spec_index + 1 < len(page_specs):
            add_page_break(document)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document.save(output_path)
    return output_path
