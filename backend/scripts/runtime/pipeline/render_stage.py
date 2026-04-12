from __future__ import annotations

from pathlib import Path

import fitz

from foundation.config import fonts
from foundation.config import runtime
from runtime.pipeline.render_inputs import resolve_render_inputs
from runtime.pipeline.render_mode import resolve_effective_render_mode
from runtime.pipeline.translation_loader import load_translated_pages
from runtime.pipeline.translation_loader import select_translated_pages
from services.rendering.api.pdf_compress import build_image_compressed_pdf_copy
from services.rendering.api.pdf_compress import compress_pdf_images_only
from services.rendering.api.pdf_overlay import apply_translated_items_to_page
from services.rendering.api.pdf_overlay import save_optimized_pdf
from services.rendering.api.pdf_overlay import strip_page_links
from services.rendering.api.render_payloads import prepare_render_payloads_by_page
from services.rendering.api.typst_page_renderer import build_book_typst_background_pdf
from services.rendering.api.typst_page_renderer import build_book_typst_pdf
from services.rendering.api.typst_page_renderer import build_dual_book_pdf
from services.rendering.api.typst_page_renderer import overlay_translated_pages_on_doc
from services.rendering.preprocess.hidden_text_strip import build_hidden_text_stripped_pdf_copy
from services.rendering.typst.shared import default_typst_temp_root


def _prepare_render_source_pdf(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    pdf_compress_dpi: int,
    start_page: int = 0,
    end_page: int = -1,
) -> tuple[Path, list[Path]]:
    temp_paths: list[Path] = []
    render_source_path = source_pdf_path
    typst_temp_root = default_typst_temp_root(output_pdf_path)

    hidden_text_stripped_path = typst_temp_root / f"{output_pdf_path.stem}.source-hidden-text-stripped.pdf"
    hidden_text_result = build_hidden_text_stripped_pdf_copy(
        render_source_path,
        hidden_text_stripped_path,
        start_page=start_page,
        end_page=end_page,
    )
    if hidden_text_result.changed and hidden_text_result.output_pdf_path is not None:
        render_source_path = hidden_text_result.output_pdf_path
        temp_paths.append(render_source_path)
        print(f"render source pdf: using hidden-text stripped copy {render_source_path}", flush=True)
    else:
        hidden_text_stripped_path.unlink(missing_ok=True)

    if pdf_compress_dpi <= 0:
        return render_source_path, temp_paths
    compressed_source_path = (
        default_typst_temp_root(output_pdf_path) / f"{output_pdf_path.stem}.source-compressed.pdf"
    )
    if build_image_compressed_pdf_copy(render_source_path, compressed_source_path, dpi=pdf_compress_dpi):
        print(f"render source pdf: using compressed copy {compressed_source_path}", flush=True)
        temp_paths.append(compressed_source_path)
        return compressed_source_path, temp_paths
    compressed_source_path.unlink(missing_ok=True)
    print("render source pdf: source image compression skipped", flush=True)
    return render_source_path, temp_paths


def render_translated_pages_map(
    *,
    source_pdf_path: Path,
    translated_pages_map: dict[int, list[dict]],
    output_pdf_path: Path,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
    strip_links: bool = False,
) -> int:
    render_source_pdf_path, temp_source_paths = _prepare_render_source_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        pdf_compress_dpi=pdf_compress_dpi,
    )
    doc = fitz.open(render_source_pdf_path)
    try:
        render_pages_map = prepare_render_payloads_by_page(translated_pages_map)
        page_indexes = sorted(translated_pages_map)
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
        for temp_source_path in temp_source_paths:
            temp_source_path.unlink(missing_ok=True)
    compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
    return len(translated_pages_map)


def build_book_from_translations(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    render_mode: str = "typst",
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
) -> int:
    render_inputs = resolve_render_inputs(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
    )
    translated_pages = load_translated_pages(
        render_inputs.translations_dir,
        manifest_path=render_inputs.translation_manifest_path,
    )
    start = max(0, start_page)
    stop = max(translated_pages) if end_page < 0 else end_page
    selected_pages = select_translated_pages(translated_pages, start_page=start, end_page=stop)
    render_source_pdf_path, temp_source_paths = _prepare_render_source_pdf(
        source_pdf_path=render_inputs.source_pdf_path,
        output_pdf_path=output_pdf_path,
        pdf_compress_dpi=pdf_compress_dpi,
        start_page=start,
        end_page=stop,
    )

    try:
        if render_mode == "dual":
            build_dual_book_pdf(
                source_pdf_path=render_source_pdf_path,
                output_pdf_path=output_pdf_path,
                translated_pages=selected_pages,
                start_page=start,
                end_page=stop,
                compile_workers=compile_workers,
                api_key=api_key,
                model=model,
                base_url=base_url,
                font_family=typst_font_family,
                cover_only=False,
            )
            compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
            return len(selected_pages)

        if extract_selected_pages:
            source_doc = fitz.open(render_source_pdf_path)
            temp_doc = fitz.open()
            try:
                temp_doc.insert_pdf(source_doc, from_page=start, to_page=stop)
                remapped_pages = {
                    page_idx - start: items
                    for page_idx, items in selected_pages.items()
                }
                overlay_translated_pages_on_doc(
                    temp_doc,
                    remapped_pages,
                    stem="book-overlay",
                    compile_workers=compile_workers,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    font_family=typst_font_family,
                    temp_root=default_typst_temp_root(output_pdf_path),
                    cover_only=False,
                )
                save_optimized_pdf(temp_doc, output_pdf_path)
            finally:
                temp_doc.close()
                source_doc.close()
            compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
            return stop - start + 1

        if render_mode in {"compact", "direct", "overlay"}:
            if render_mode in {"compact", "direct"}:
                print(f"render mode '{render_mode}' is deprecated; using typst overlay instead", flush=True)
            build_book_typst_pdf(
                source_pdf_path=render_source_pdf_path,
                output_pdf_path=output_pdf_path,
                translated_pages=selected_pages,
                compile_workers=compile_workers,
                api_key=api_key,
                model=model,
                base_url=base_url,
                font_family=typst_font_family,
                cover_only=False,
            )
            compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
            return len(selected_pages)

        if render_mode == "typst":
            print("typst background render selected", flush=True)
            build_book_typst_background_pdf(
                source_pdf_path=render_source_pdf_path,
                output_pdf_path=output_pdf_path,
                translated_pages=selected_pages,
                api_key=api_key,
                model=model,
                base_url=base_url,
                font_family=typst_font_family,
            )
            compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
            return len(selected_pages)

        build_book_typst_pdf(
            source_pdf_path=render_source_pdf_path,
            output_pdf_path=output_pdf_path,
            translated_pages=selected_pages,
            compile_workers=compile_workers,
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=typst_font_family,
            cover_only=False,
        )
        compress_pdf_images_only(output_pdf_path, dpi=pdf_compress_dpi)
        return len(selected_pages)
    finally:
        for temp_source_path in temp_source_paths:
            temp_source_path.unlink(missing_ok=True)


def build_book_pipeline(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int = 0,
    end_page: int = -1,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    render_mode: str = "typst",
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
) -> dict:
    pages_rendered = build_book_from_translations(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
        start_page=start_page,
        end_page=end_page,
        compile_workers=compile_workers,
        extract_selected_pages=extract_selected_pages,
        render_mode=render_mode,
        api_key=api_key,
        model=model,
        base_url=base_url,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
    )
    return {
        "output_pdf_path": output_pdf_path,
        "pages_rendered": pages_rendered,
        "extract_selected_pages": extract_selected_pages,
    }


def run_render_stage(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int,
    end_page: int,
    render_mode: str,
    translated_pages_map: dict[int, list[dict]] | None = None,
    compile_workers: int | None = None,
    extract_selected_pages: bool = False,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI,
) -> dict:
    render_inputs = resolve_render_inputs(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
    )
    auto_pages_map = translated_pages_map
    if render_mode == "auto" and auto_pages_map is None:
        auto_pages_map = load_translated_pages(
            render_inputs.translations_dir,
            manifest_path=render_inputs.translation_manifest_path,
        )
    effective_render_mode = resolve_effective_render_mode(
        render_mode=render_mode,
        source_pdf_path=render_inputs.source_pdf_path,
        start_page=start_page,
        end_page=end_page,
        translated_pages_map=auto_pages_map,
    )
    pages_rendered = build_book_from_translations(
        source_pdf_path=render_inputs.source_pdf_path,
        output_pdf_path=output_pdf_path,
        translations_dir=render_inputs.translations_dir,
        translation_manifest_path=render_inputs.translation_manifest_path,
        start_page=start_page,
        end_page=end_page,
        compile_workers=compile_workers,
        extract_selected_pages=extract_selected_pages,
        render_mode=effective_render_mode,
        api_key=api_key,
        model=model,
        base_url=base_url,
        typst_font_family=typst_font_family,
        pdf_compress_dpi=pdf_compress_dpi,
    )
    return {
        "output_pdf_path": output_pdf_path,
        "pages_rendered": pages_rendered,
        "effective_render_mode": effective_render_mode,
        "extract_selected_pages": extract_selected_pages,
    }
