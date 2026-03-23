import argparse
from pathlib import Path

from config import fonts
from config import layout
from config import paths
from config import runtime
from pipeline.book_pipeline import build_book_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a translated PDF from per-page translation JSON files, either as a full-book overlay or as an extracted page range.",
    )
    parser.add_argument(
        "--translations-dir",
        type=str,
        default="translations/book",
        help="Directory under output/ containing per-page translation JSON files.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="dev-book.pdf",
        help="Output PDF filename placed under output/.",
    )
    parser.add_argument(
        "--start-page",
        type=int,
        default=0,
        help="Zero-based start page index to overlay or extract. Default is the first page.",
    )
    parser.add_argument(
        "--end-page",
        type=int,
        default=-1,
        help="Zero-based end page index, inclusive. Default is the last translated page.",
    )
    parser.add_argument(
        "--source-pdf",
        type=str,
        default=str(paths.SOURCE_PDF),
        help="Source PDF path.",
    )
    parser.add_argument(
        "--compile-workers",
        type=int,
        default=0,
        help="Parallel Typst overlay compilation workers. 0 means auto.",
    )
    parser.add_argument(
        "--extract-selected-pages",
        action="store_true",
        help="Extract only the selected page range into the output PDF instead of keeping the full source book.",
    )
    parser.add_argument(
        "--render-mode",
        type=str,
        default="typst",
        choices=["typst", "direct", "dual"],
        help="Book output mode. direct writes translated text back into the original PDF. dual places the original page on the left and translated page on the right.",
    )
    parser.add_argument(
        "--typst-font-family",
        type=str,
        default=fonts.TYPST_DEFAULT_FONT_FAMILY,
        help="Base Typst font family name.",
    )
    parser.add_argument(
        "--pdf-compress-dpi",
        type=int,
        default=runtime.DEFAULT_PDF_COMPRESS_DPI,
        help="Final PDF image downsample DPI after rendering. 0 disables post-compression.",
    )
    parser.add_argument("--body-font-size-factor", type=float, default=layout.BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=layout.BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=layout.INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=layout.INNER_BBOX_SHRINK_Y)
    parser.add_argument("--inner-bbox-dense-shrink-x", type=float, default=layout.INNER_BBOX_DENSE_SHRINK_X)
    parser.add_argument("--inner-bbox-dense-shrink-y", type=float, default=layout.INNER_BBOX_DENSE_SHRINK_Y)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    layout.apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )
    output_pdf_path = paths.OUTPUT_DIR / args.output
    summary = build_book_pipeline(
        source_pdf_path=Path(args.source_pdf),
        translations_dir=paths.OUTPUT_DIR / args.translations_dir,
        output_pdf_path=output_pdf_path,
        start_page=args.start_page,
        end_page=args.end_page,
        compile_workers=args.compile_workers or None,
        extract_selected_pages=args.extract_selected_pages,
        render_mode=args.render_mode,
        typst_font_family=args.typst_font_family,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )
    print(f"built book pdf: {output_pdf_path}")
    print(f"pages rendered: {summary['pages_rendered']}")


if __name__ == "__main__":
    main()
