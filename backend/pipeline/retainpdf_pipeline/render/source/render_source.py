from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

from retainpdf_pipeline.render.source.compression.pdf_copy import build_image_compressed_pdf_copy
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.source.intermediate_paths import intermediate_pdf_path
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source.preparation.hidden_text_strip import build_hidden_text_stripped_pdf_copy
from retainpdf_pipeline.render.source.preparation.xobject_sanitize import build_invalid_xobject_sanitized_pdf_copy
from retainpdf_pipeline.render.source_cleanup import SourceCleanupOptions
from retainpdf_pipeline.render.source_cleanup import SourceCleanupRequest
from retainpdf_pipeline.render.source_cleanup import execute_source_cleanup
from retainpdf_pipeline.render.output.typst.shared import default_typst_temp_root
from retainpdf_pipeline.render.policy import source_cleanup_max_seconds
from retainpdf_pipeline.foundation.config import layout


@dataclass(frozen=True)
class RenderSourcePdf:
    path: Path
    temp_paths: list[Path]
    image_compressed: bool = False
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()
    source_cleanup_cover_fallback_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None
    document_analysis: RenderDocumentAnalysis | None = None


def build_render_source_pdf(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    pdf_compress_dpi: int,
    translated_pages: dict[int, list[dict]] | None = None,
    protected_pages: dict[int, list[dict]] | None = None,
    strip_hidden_text: bool = True,
    start_page: int = 0,
    end_page: int = -1,
    artifact_mode: bool = False,
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None,
    source_cleanup_strategy: str = "pikepdf_text_strip",
    document_analysis: RenderDocumentAnalysis | None = None,
    pdf_structure_profile_path: Path | None = None,
) -> RenderSourcePdf:
    temp_paths: list[Path] = []
    render_source_path = source_pdf_path
    typst_temp_root = default_typst_temp_root(output_pdf_path)
    work_root = output_pdf_path.parent if artifact_mode else typst_temp_root
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()
    source_cleanup_cover_fallback_page_indices: frozenset[int] = frozenset()
    sanitize_started = time.perf_counter()
    sanitized_source_path = intermediate_pdf_path(
        work_root=work_root,
        output_pdf_path=output_pdf_path,
        suffix=".source-xobject-sanitized.pdf",
    )
    sanitize_result = build_invalid_xobject_sanitized_pdf_copy(
        source_pdf_path=render_source_path,
        output_pdf_path=sanitized_source_path,
    )
    print(f"render source pdf: invalid-xobject sanitize elapsed={time.perf_counter() - sanitize_started:.2f}s", flush=True)
    if sanitize_result.changed and sanitize_result.output_pdf_path is not None:
        render_source_path = sanitize_result.output_pdf_path
        if not artifact_mode:
            temp_paths.append(render_source_path)
        print(
            f"render source pdf: using invalid-xobject sanitized copy {render_source_path}",
            flush=True,
        )
    else:
        sanitized_source_path.unlink(missing_ok=True)

    hidden_text_page_indices = document_analysis.hidden_text_strip_page_indices if document_analysis is not None else frozenset()
    if strip_hidden_text and hidden_text_page_indices:
        hidden_started = time.perf_counter()
        hidden_text_stripped_path = intermediate_pdf_path(
            work_root=work_root,
            output_pdf_path=output_pdf_path,
            suffix=".source-hidden-text-stripped.pdf",
        )
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
        translated_page_indices = frozenset(page_idx for page_idx, items in translated_pages.items() if items)
        pikepdf_text_strip_page_indices = (
            document_analysis.pikepdf_text_strip_page_indices & translated_page_indices
            if document_analysis is not None
            else translated_page_indices
        )
        if not pikepdf_text_strip_page_indices:
            bbox_text_strip_skipped_page_indices = translated_page_indices
            source_cleanup_cover_fallback_page_indices = translated_page_indices
            print(
                "render source pdf: bbox-text strip skipped "
                f"no-pikepdf-text-strip-pages pages={len(bbox_text_strip_skipped_page_indices)}",
                flush=True,
            )
        else:
            bbox_started = time.perf_counter()
            bbox_text_stripped_path = intermediate_pdf_path(
                work_root=work_root,
                output_pdf_path=output_pdf_path,
                suffix=".source-bbox-text-stripped.pdf",
            )
            source_cleanup_result = execute_source_cleanup(
                SourceCleanupRequest(
                    source_pdf_path=render_source_path,
                    output_pdf_path=bbox_text_stripped_path,
                    translated_pages=translated_pages,
                    protected_pages=protected_pages,
                    candidates=bbox_text_strip_candidates,
                    options=SourceCleanupOptions(
                        strategy=source_cleanup_strategy,
                        skip_formula_pages=False,
                        max_elapsed_seconds=source_cleanup_max_seconds(),
                    ),
                    document_analysis=document_analysis,
                )
            )
            bbox_text_result = source_cleanup_result.bbox_text_strip
            print(f"render source pdf: bbox-text strip elapsed={time.perf_counter() - bbox_started:.2f}s", flush=True)
            bbox_text_stripped_page_indices = bbox_text_result.changed_page_indices
            bbox_text_strip_skipped_page_indices = (
                bbox_text_result.skipped_complex_page_indices
                | bbox_text_result.skipped_no_text_overlap_page_indices
                | bbox_text_result.skipped_visual_background_page_indices
                | bbox_text_result.skipped_form_xobject_page_indices
                | bbox_text_result.strip_no_effect_page_indices
            )
            source_text_precleaned_page_indices = bbox_text_result.changed_page_indices
            source_cleanup_cover_fallback_page_indices = (
                bbox_text_result.skipped_complex_page_indices
                | bbox_text_result.skipped_visual_background_page_indices
                | bbox_text_result.skipped_form_xobject_page_indices
                | bbox_text_result.strip_no_effect_page_indices
            ) - bbox_text_result.changed_page_indices
            bbox_text_strip_candidates = bbox_text_result.candidates
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

    if pdf_compress_dpi <= 0:
        return RenderSourcePdf(
            path=render_source_path,
            temp_paths=temp_paths,
            bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
            bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            source_cleanup_cover_fallback_page_indices=source_cleanup_cover_fallback_page_indices,
            bbox_text_strip_candidates=bbox_text_strip_candidates,
            document_analysis=document_analysis,
        )
    compress_started = time.perf_counter()
    compressed_source_path = intermediate_pdf_path(
        work_root=work_root,
        output_pdf_path=output_pdf_path,
        suffix=".source-compressed.pdf",
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
            source_cleanup_cover_fallback_page_indices=source_cleanup_cover_fallback_page_indices,
            bbox_text_strip_candidates=bbox_text_strip_candidates,
            document_analysis=document_analysis,
        )
    compressed_source_path.unlink(missing_ok=True)
    print("render source pdf: source image compression skipped", flush=True)
    return RenderSourcePdf(
        path=render_source_path,
        temp_paths=temp_paths,
        bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
        bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
        source_text_precleaned_page_indices=source_text_precleaned_page_indices,
        source_cleanup_cover_fallback_page_indices=source_cleanup_cover_fallback_page_indices,
        bbox_text_strip_candidates=bbox_text_strip_candidates,
        document_analysis=document_analysis,
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
    pdf_structure_profile_path: Path | None = None,
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
        pdf_structure_profile_path=pdf_structure_profile_path,
    )
    return prepared.path, prepared.temp_paths
