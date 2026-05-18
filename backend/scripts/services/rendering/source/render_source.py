from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

from services.rendering.source.compression.pdf_copy import build_image_compressed_pdf_copy
from services.rendering.source.preparation.bbox_text_strip import build_bbox_text_stripped_pdf_copy
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripCandidates
from services.rendering.source.preparation.hidden_text_strip import build_hidden_text_stripped_pdf_copy
from services.rendering.source.preparation.redact_restore_formula import build_redact_restore_formula_pdf_copy
from services.rendering.output.typst.shared import default_typst_temp_root
from foundation.config import layout


@dataclass(frozen=True)
class RenderSourcePdf:
    path: Path
    temp_paths: list[Path]
    image_compressed: bool = False
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()


def build_render_source_pdf(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    pdf_compress_dpi: int,
    translated_pages: dict[int, list[dict]] | None = None,
    strip_hidden_text: bool = True,
    start_page: int = 0,
    end_page: int = -1,
    artifact_mode: bool = False,
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> RenderSourcePdf:
    temp_paths: list[Path] = []
    render_source_path = source_pdf_path
    typst_temp_root = default_typst_temp_root(output_pdf_path)
    work_root = output_pdf_path.parent if artifact_mode else typst_temp_root
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()

    if strip_hidden_text:
        hidden_started = time.perf_counter()
        hidden_text_stripped_path = work_root / f"{output_pdf_path.stem}.source-hidden-text-stripped.pdf"
        hidden_text_result = build_hidden_text_stripped_pdf_copy(
            render_source_path,
            hidden_text_stripped_path,
            start_page=start_page,
            end_page=end_page,
        )
        print(f"render source pdf: hidden-text strip elapsed={time.perf_counter() - hidden_started:.2f}s", flush=True)
        if hidden_text_result.changed and hidden_text_result.output_pdf_path is not None:
            render_source_path = hidden_text_result.output_pdf_path
            if not artifact_mode:
                temp_paths.append(render_source_path)
            print(f"render source pdf: using hidden-text stripped copy {render_source_path}", flush=True)
        else:
            hidden_text_stripped_path.unlink(missing_ok=True)
    else:
        print("render source pdf: hidden-text strip skipped", flush=True)

    if translated_pages and layout.use_bbox_text_strip_cleanup(source_cleanup_strategy):
        bbox_started = time.perf_counter()
        bbox_text_stripped_path = work_root / f"{output_pdf_path.stem}.source-bbox-text-stripped.pdf"
        bbox_text_result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=render_source_path,
            output_pdf_path=bbox_text_stripped_path,
            translated_pages=translated_pages,
            candidates=bbox_text_strip_candidates,
            skip_formula_pages=False,
        )
        print(f"render source pdf: bbox-text strip elapsed={time.perf_counter() - bbox_started:.2f}s", flush=True)
        bbox_text_stripped_page_indices = bbox_text_result.changed_page_indices
        bbox_text_strip_skipped_page_indices = bbox_text_result.skipped_complex_page_indices
        source_text_precleaned_page_indices = (
            bbox_text_result.changed_page_indices | bbox_text_result.skipped_no_text_overlap_page_indices
        )
        if bbox_text_result.changed and bbox_text_result.output_pdf_path is not None:
            render_source_path = bbox_text_result.output_pdf_path
            if not artifact_mode:
                temp_paths.append(render_source_path)
            print(
                f"render source pdf: using bbox-text stripped copy {render_source_path}",
                flush=True,
            )
        else:
            bbox_text_stripped_path.unlink(missing_ok=True)

    if translated_pages and layout.use_redact_restore_formula_cleanup(source_cleanup_strategy):
        restore_started = time.perf_counter()
        restored_source_path = work_root / f"{output_pdf_path.stem}.source-redact-restore-formulas.pdf"
        restored_result = build_redact_restore_formula_pdf_copy(
            source_pdf_path=render_source_path,
            output_pdf_path=restored_source_path,
            translated_pages=translated_pages,
        )
        print(f"render source pdf: redact-restore formulas elapsed={time.perf_counter() - restore_started:.2f}s", flush=True)
        if restored_result.changed and restored_result.output_pdf_path is not None:
            render_source_path = restored_result.output_pdf_path
            bbox_text_stripped_page_indices = restored_result.changed_page_indices
            source_text_precleaned_page_indices = restored_result.changed_page_indices
            if not artifact_mode:
                temp_paths.append(render_source_path)
            print(
                f"render source pdf: using redact-restore formula copy {render_source_path}",
                flush=True,
            )
        else:
            restored_source_path.unlink(missing_ok=True)

    if pdf_compress_dpi <= 0:
        return RenderSourcePdf(
            path=render_source_path,
            temp_paths=temp_paths,
            bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
            bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
        )
    compress_started = time.perf_counter()
    compressed_source_path = (
        work_root / f"{output_pdf_path.stem}.source-compressed.pdf"
    )
    if build_image_compressed_pdf_copy(render_source_path, compressed_source_path, dpi=pdf_compress_dpi):
        print(f"render source pdf: image compression elapsed={time.perf_counter() - compress_started:.2f}s", flush=True)
        print(f"render source pdf: using compressed copy {compressed_source_path}", flush=True)
        if not artifact_mode:
            temp_paths.append(compressed_source_path)
        return RenderSourcePdf(
            path=compressed_source_path,
            temp_paths=temp_paths,
            image_compressed=True,
            bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
            bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
        )
    compressed_source_path.unlink(missing_ok=True)
    print("render source pdf: source image compression skipped", flush=True)
    return RenderSourcePdf(
        path=render_source_path,
        temp_paths=temp_paths,
        bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
        bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
        source_text_precleaned_page_indices=source_text_precleaned_page_indices,
    )


def prepare_render_source_pdf(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    pdf_compress_dpi: int,
    translated_pages: dict[int, list[dict]] | None = None,
    strip_hidden_text: bool = True,
    start_page: int = 0,
    end_page: int = -1,
    artifact_mode: bool = False,
) -> tuple[Path, list[Path]]:
    prepared = build_render_source_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        pdf_compress_dpi=pdf_compress_dpi,
        translated_pages=translated_pages,
        strip_hidden_text=strip_hidden_text,
        start_page=start_page,
        end_page=end_page,
        artifact_mode=artifact_mode,
    )
    return prepared.path, prepared.temp_paths
