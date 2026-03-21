import argparse
from pathlib import Path

from common.config import BODY_FONT_SIZE_FACTOR
from common.config import BODY_LEADING_FACTOR
from common.config import INNER_BBOX_DENSE_SHRINK_X
from common.config import INNER_BBOX_DENSE_SHRINK_Y
from common.config import INNER_BBOX_SHRINK_X
from common.config import INNER_BBOX_SHRINK_Y
from common.config import OUTPUT_DIR
from common.config import TYPST_DEFAULT_FONT_FAMILY
from common.config import apply_layout_tuning
from common.input_resolver import resolve_case_sources
from pipeline.book_pipeline import run_book_pipeline
from translation.deepseek_client import DEFAULT_BASE_URL
from translation.deepseek_client import get_api_key
from translation.deepseek_client import normalize_base_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Unified end-to-end pipeline. Prefer explicit --source-json/--source-pdf for API-style calls; input_dir auto-discovery is kept as a convenience fallback.",
    )
    parser.add_argument(
        "input_dir",
        nargs="?",
        type=str,
        default="",
        help="Optional folder containing exactly one .json OCR file and one .pdf source file.",
    )
    parser.add_argument("--source-json", type=str, default="", help="Explicit OCR JSON source path.")
    parser.add_argument("--source-pdf", type=str, default="", help="Explicit source PDF path.")
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index. Default is the first page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. Default is the last page.")
    parser.add_argument("--batch-size", type=int, default=6, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent translation requests.")
    parser.add_argument(
        "--mode",
        type=str,
        default="sci",
        choices=["fast", "precise", "sci"],
        help="Translation mode. Default is sci.",
    )
    parser.add_argument(
        "--skip-title-translation",
        action="store_true",
        help="Do not translate OCR blocks with block_type=title.",
    )
    parser.add_argument("--classify-batch-size", type=int, default=12, help="Number of suspicious items per classification API call.")
    parser.add_argument("--api-key", type=str, default="", help="Optional API key. Prefer env DEEPSEEK_API_KEY.")
    parser.add_argument("--model", type=str, default="deepseek-chat", help="Model name.")
    parser.add_argument(
        "--base-url",
        type=str,
        default="https://api.deepseek.com/v1",
        help="OpenAI-compatible API base URL ending with /v1.",
    )
    parser.add_argument(
        "--render-mode",
        type=str,
        default="typst",
        choices=["auto", "compact", "direct", "typst", "dual"],
        help="Rendering mode for translated pages.",
    )
    parser.add_argument(
        "--compile-workers",
        type=int,
        default=0,
        help="Parallel Typst overlay compilation workers. 0 means auto.",
    )
    parser.add_argument(
        "--typst-font-family",
        type=str,
        default=TYPST_DEFAULT_FONT_FAMILY,
        help="Base Typst font family name.",
    )
    parser.add_argument(
        "--name",
        type=str,
        default="",
        help="Output name prefix. Default uses the source PDF stem.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="",
        help="Translation JSON output directory under output/. Example: translations/test9-run",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Final output PDF filename under output/. Example: test9-run.pdf",
    )
    parser.add_argument("--body-font-size-factor", type=float, default=BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=INNER_BBOX_SHRINK_Y)
    parser.add_argument("--inner-bbox-dense-shrink-x", type=float, default=INNER_BBOX_DENSE_SHRINK_X)
    parser.add_argument("--inner-bbox-dense-shrink-y", type=float, default=INNER_BBOX_DENSE_SHRINK_Y)
    return parser.parse_args()


def build_default_names(stem: str, mode: str, render_mode: str) -> tuple[str, str]:
    suffix = f"{mode}-{render_mode}"
    translations_dir = f"translations/{stem}-{suffix}"
    output_pdf = f"{stem}-{suffix}.pdf"
    return translations_dir, output_pdf


def resolve_sources(args: argparse.Namespace) -> tuple[Path, Path, str, str]:
    source_json_arg = args.source_json.strip()
    source_pdf_arg = args.source_pdf.strip()
    input_dir_arg = args.input_dir.strip()

    if source_json_arg or source_pdf_arg:
        if not (source_json_arg and source_pdf_arg):
            raise RuntimeError("When using explicit paths, both --source-json and --source-pdf are required.")
        source_json = Path(source_json_arg).resolve()
        source_pdf = Path(source_pdf_arg).resolve()
        if not source_json.exists():
            raise RuntimeError(f"source json not found: {source_json}")
        if not source_pdf.exists():
            raise RuntimeError(f"source pdf not found: {source_pdf}")
        return source_json, source_pdf, source_pdf.stem or source_json.stem, ""

    if not input_dir_arg:
        raise RuntimeError("Provide either both --source-json/--source-pdf or one input_dir.")

    input_dir = Path(input_dir_arg).resolve()
    source_json, source_pdf, detected_stem = resolve_case_sources(input_dir)
    return source_json, source_pdf, detected_stem, str(input_dir)


def main() -> None:
    args = parse_args()
    apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )

    source_json, source_pdf, detected_stem, input_dir_text = resolve_sources(args)
    run_name = args.name.strip() or detected_stem
    translations_dir, output_pdf = build_default_names(run_name, args.mode, args.render_mode)
    if args.output_dir.strip():
        translations_dir = args.output_dir.strip().strip("/")
    if args.output.strip():
        output_pdf = args.output.strip()

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )

    result = run_book_pipeline(
        source_json_path=source_json,
        source_pdf_path=source_pdf,
        output_dir=OUTPUT_DIR / translations_dir,
        output_pdf_path=OUTPUT_DIR / output_pdf,
        api_key=api_key,
        start_page=args.start_page,
        end_page=args.end_page,
        batch_size=args.batch_size,
        workers=args.workers,
        model=args.model,
        base_url=args.base_url,
        mode=args.mode,
        classify_batch_size=args.classify_batch_size,
        skip_title_translation=args.skip_title_translation,
        render_mode=args.render_mode,
        compile_workers=args.compile_workers or None,
        typst_font_family=args.typst_font_family,
    )

    if input_dir_text:
        print(f"input dir: {input_dir_text}")
    print(f"source json: {source_json}")
    print(f"source pdf: {source_pdf}")
    print(f"translation dir: {result['output_dir']}")
    print(f"output pdf: {result['output_pdf_path']}")
    print(f"pages processed: {result['pages_processed']}")
    print(f"translated items: {result['translated_items_total']}")
    print(f"translate+render time: {result['translate_elapsed']:.2f}s")
    print(f"save time: {result['save_elapsed']:.2f}s")
    print(f"total time: {result['total_elapsed']:.2f}s")


if __name__ == "__main__":
    main()
