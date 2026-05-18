from __future__ import annotations

from pathlib import Path

import fitz

from foundation.config import fonts
from foundation.config import runtime
from services.rendering.legacy.pdf_compress import compress_pdf_images_only
from services.rendering.source.dev_overlay.text_draw import apply_translated_items_to_page
from services.rendering.document.pdf_ops import save_optimized_pdf
from services.rendering.document.pdf_ops import strip_page_links
from services.rendering.output.typst.book_support import prepare_translated_pages_for_render
from services.rendering.source.render_source import build_render_source_pdf


def render_translated_pages_map(
    *,
    source_pdf_path: Path,
    translated_pages_map: dict[int, list[dict]],
    output_pdf_path: Path,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    strip_links: bool = False,
) -> int:
    render_source_pdf = build_render_source_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        pdf_compress_dpi=pdf_compress_dpi,
        translated_pages=translated_pages_map,
        strip_hidden_text=False,
    )
    doc = fitz.open(render_source_pdf.path)
    try:
        render_pages_map = prepare_translated_pages_for_render(render_source_pdf.path, translated_pages_map)
        for page_idx in sorted(render_pages_map):
            if 0 <= page_idx < len(doc):
                page = doc[page_idx]
                if strip_links:
                    strip_page_links(page)
                apply_translated_items_to_page(
                    page,
                    render_pages_map[page_idx],
                    fonts.DEFAULT_FONT_PATH,
                    cover_only=False,
                )
        save_optimized_pdf(doc, output_pdf_path)
    finally:
        doc.close()
        for temp_source_path in render_source_pdf.temp_paths:
            temp_source_path.unlink(missing_ok=True)
    if render_source_pdf.image_compressed:
        print(
            "final image-only compress: skipped for direct_overlay because render source was already compressed",
            flush=True,
        )
    else:
        compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
    return len(translated_pages_map)
