from __future__ import annotations

import argparse
from pathlib import Path

import fitz


def build_side_by_side_pdf(source_pdf: Path, translated_pdf: Path, output_pdf: Path) -> None:
    with fitz.open(source_pdf) as source_doc, fitz.open(translated_pdf) as translated_doc:
        if source_doc.page_count < 1:
            raise RuntimeError(f"source pdf has no pages: {source_pdf}")
        if translated_doc.page_count < 1:
            raise RuntimeError(f"translated pdf has no pages: {translated_pdf}")
        page_count = max(source_doc.page_count, translated_doc.page_count)
        output_pdf.parent.mkdir(parents=True, exist_ok=True)
        with fitz.open() as out_doc:
            for page_index in range(page_count):
                source_rect = _page_rect(source_doc, page_index)
                translated_rect = _page_rect(translated_doc, page_index)
                left_width = source_rect.width if source_rect is not None else translated_rect.width
                right_width = translated_rect.width if translated_rect is not None else source_rect.width
                page_height = max(
                    source_rect.height if source_rect is not None else 0.0,
                    translated_rect.height if translated_rect is not None else 0.0,
                )
                out_page = out_doc.new_page(width=left_width + right_width, height=page_height)
                if page_index < source_doc.page_count:
                    out_page.show_pdf_page(
                        fitz.Rect(0, 0, left_width, page_height),
                        source_doc,
                        page_index,
                        keep_proportion=True,
                    )
                if page_index < translated_doc.page_count:
                    out_page.show_pdf_page(
                        fitz.Rect(left_width, 0, left_width + right_width, page_height),
                        translated_doc,
                        page_index,
                        keep_proportion=True,
                    )
            out_doc.save(output_pdf, garbage=4, deflate=True)


def _page_rect(doc: fitz.Document, page_index: int) -> fitz.Rect | None:
    if page_index >= doc.page_count:
        return None
    return doc[page_index].rect


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a left/right source-vs-translated PDF.")
    parser.add_argument("--source-pdf", type=Path, required=True)
    parser.add_argument("--translated-pdf", type=Path, required=True)
    parser.add_argument("--output-pdf", type=Path, required=True)
    args = parser.parse_args()
    build_side_by_side_pdf(args.source_pdf, args.translated_pdf, args.output_pdf)


if __name__ == "__main__":
    main()
