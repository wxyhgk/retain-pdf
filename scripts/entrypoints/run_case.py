import argparse
import shutil
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from foundation.shared.job_dirs import create_job_dirs
from foundation.shared.input_resolver import resolve_case_sources
from foundation.config import fonts
from foundation.config import layout
from foundation.config import paths
from foundation.config import runtime
from runtime.pipeline.book_pipeline import run_book_pipeline
from services.translation.llm import DEFAULT_BASE_URL
from services.translation.llm import get_api_key
from services.translation.llm import normalize_base_url


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
    parser.add_argument(
        "--source-json",
        type=str,
        default="",
        help="Explicit OCR JSON source path. Prefer normalized document.v1.json; raw MinerU layout.json is auto-normalized on load.",
    )
    parser.add_argument("--source-pdf", type=str, default="", help="Explicit source PDF path.")
    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index. Default is the first page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. Default is the last page.")
    parser.add_argument("--batch-size", type=int, default=1, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=100, help="Concurrent translation requests.")
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
    parser.add_argument("--rule-profile-name", type=str, default="general_sci", help="Built-in rule profile name.")
    parser.add_argument("--custom-rules-text", type=str, default="", help="Extra rule text injected into model context.")
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
        choices=["auto", "overlay", "typst", "dual", "direct", "compact"],
        help="Rendering mode for translated pages. auto chooses between typst overlay and typst background. direct/compact are kept only as compatibility aliases and now map to typst overlay.",
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
        default=fonts.TYPST_DEFAULT_FONT_FAMILY,
        help="Base Typst font family name.",
    )
    parser.add_argument(
        "--pdf-compress-dpi",
        type=int,
        default=runtime.DEFAULT_PDF_COMPRESS_DPI,
        help="Final PDF image downsample DPI after rendering. 0 disables post-compression.",
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
    parser.add_argument("--job-id", type=str, default="", help="Optional explicit structured output job directory name.")
    parser.add_argument("--output-root", type=str, default=str(paths.OUTPUT_DIR), help="Root directory for structured job outputs.")
    parser.add_argument("--body-font-size-factor", type=float, default=layout.BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=layout.BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=layout.INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=layout.INNER_BBOX_SHRINK_Y)
    parser.add_argument("--inner-bbox-dense-shrink-x", type=float, default=layout.INNER_BBOX_DENSE_SHRINK_X)
    parser.add_argument("--inner-bbox-dense-shrink-y", type=float, default=layout.INNER_BBOX_DENSE_SHRINK_Y)
    return parser.parse_args()


def build_default_names(stem: str, mode: str, render_mode: str) -> tuple[str, str]:
    translations_dir = "translations"
    output_pdf = f"{stem}-translated.pdf"
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
    layout.apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )

    source_json, source_pdf, detected_stem, input_dir_text = resolve_sources(args)
    run_name = args.name.strip() or detected_stem
    job_dirs = create_job_dirs(Path(args.output_root), args.job_id.strip() or None)
    source_json_copy = job_dirs.json_pdf_dir / source_json.name
    source_pdf_copy = job_dirs.origin_pdf_dir / source_pdf.name
    shutil.copy2(source_json, source_json_copy)
    shutil.copy2(source_pdf, source_pdf_copy)

    translations_rel, output_pdf_name = build_default_names(run_name, args.mode, args.render_mode)
    translations_dir = job_dirs.trans_pdf_dir / translations_rel
    output_pdf = job_dirs.trans_pdf_dir / output_pdf_name
    if args.output_dir.strip():
        translations_dir = job_dirs.trans_pdf_dir / args.output_dir.strip().strip("/")
    if args.output.strip():
        output_pdf = job_dirs.trans_pdf_dir / args.output.strip().strip("/")

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )

    result = run_book_pipeline(
        source_json_path=source_json_copy,
        source_pdf_path=source_pdf_copy,
        output_dir=translations_dir,
        output_pdf_path=output_pdf,
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
        rule_profile_name=args.rule_profile_name,
        custom_rules_text=args.custom_rules_text,
        compile_workers=args.compile_workers or None,
        typst_font_family=args.typst_font_family,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )

    if input_dir_text:
        print(f"input dir: {input_dir_text}")
    print(f"job root: {job_dirs.root}")
    print(f"source json: {source_json}")
    print(f"source pdf: {source_pdf}")
    print(f"source: {job_dirs.source_dir}")
    print(f"ocr: {job_dirs.ocr_dir}")
    print(f"translated: {job_dirs.translated_dir}")
    print(f"typst: {job_dirs.typst_dir}")
    print(f"translation dir: {result['output_dir']}")
    if result.get("rule_profile_name"):
        print(f"rule profile: {result['rule_profile_name']}")
    print(f"output pdf: {result['output_pdf_path']}")
    print(f"pages processed: {result['pages_processed']}")
    print(f"translated items: {result['translated_items_total']}")
    print(f"translation time: {result['translate_elapsed']:.2f}s")
    print(f"render+save time: {result['save_elapsed']:.2f}s")
    print(f"total time: {result['total_elapsed']:.2f}s")


if __name__ == "__main__":
    main()
