from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from dataclasses import dataclass
import os
from pathlib import Path
import time

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_page_progress
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_book_overlay_pdf
from retainpdf_pipeline.render.output.typst.shared import default_compile_workers
from retainpdf_pipeline.render.output.typst.shared import prepare_typst_work_dir


DEFAULT_CHUNK_PAGE_COUNT = 128
MIN_CHUNKED_OVERLAY_PAGES = 256


@dataclass(frozen=True)
class OverlayChunkCompileResult:
    chunk_pdf_paths: list[Path]
    chunk_source_page_indices: list[list[int]]
    elapsed_seconds: float
    chunk_page_count: int
    chunk_count: int
    workers: int


def should_use_chunked_overlay_compile(page_count: int) -> bool:
    if os.environ.get("RETAIN_TYPST_OVERLAY_CHUNKED", "").strip() not in {"1", "true", "True"}:
        return False
    threshold = _env_int("RETAIN_TYPST_OVERLAY_CHUNK_MIN_PAGES", MIN_CHUNKED_OVERLAY_PAGES)
    return page_count >= max(1, threshold)


def compile_book_overlay_pdf_chunks(
    *,
    ordered_page_indices: list[int],
    book_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    compile_workers: int | None = None,
) -> OverlayChunkCompileResult:
    started = time.perf_counter()
    chunk_page_count = _env_int("RETAIN_TYPST_OVERLAY_CHUNK_PAGES", DEFAULT_CHUNK_PAGE_COUNT)
    chunks = _overlay_compile_chunks(
        ordered_page_indices=ordered_page_indices,
        book_specs=book_specs,
        chunk_page_count=max(1, chunk_page_count),
    )
    max_workers = min(len(chunks), compile_workers or default_compile_workers(len(chunks)))
    chunk_pdf_paths: list[Path | None] = [None for _ in chunks]
    chunk_source_page_indices: list[list[int]] = [chunk[0] for chunk in chunks]

    def compile_chunk(chunk_index: int, specs: list[tuple[float, float, list[dict]]]) -> Path:
        chunk_stem = f"{stem}-chunk-{chunk_index + 1:04d}"
        base_dir = temp_root or Path.cwd()
        work_dir = prepare_typst_work_dir(base_dir, "book-overlay-chunks", chunk_stem)
        return compile_typst_book_overlay_pdf(
            specs,
            stem=chunk_stem,
            font_family=font_family,
            include_cover_rect=include_cover_rect,
            font_paths=font_paths,
            work_dir=work_dir,
        )

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(compile_chunk, chunk_index, specs): chunk_index
            for chunk_index, (_page_indices, specs) in enumerate(chunks)
        }
        completed_pages = 0
        total_pages = len(book_specs)
        for future in as_completed(future_map):
            chunk_index = future_map[future]
            chunk_pdf_paths[chunk_index] = future.result()
            completed_pages += len(chunks[chunk_index][1])
            emit_render_page_progress(
                current=min(completed_pages, total_pages),
                total=total_pages,
                message=f"正在分片编译 Typst overlay，第 {min(completed_pages, total_pages)}/{total_pages} 页",
                payload={
                    "render_stage": "typst_chunked_book_compile",
                    "chunk_index": chunk_index,
                    "chunk_count": len(chunks),
                },
            )

    return OverlayChunkCompileResult(
        chunk_pdf_paths=[path for path in chunk_pdf_paths if path is not None],
        chunk_source_page_indices=chunk_source_page_indices,
        elapsed_seconds=time.perf_counter() - started,
        chunk_page_count=max(1, chunk_page_count),
        chunk_count=len(chunks),
        workers=max_workers,
    )


def _overlay_compile_chunks(
    *,
    ordered_page_indices: list[int],
    book_specs: list[tuple[float, float, list[dict]]],
    chunk_page_count: int,
) -> list[tuple[list[int], list[tuple[float, float, list[dict]]]]]:
    chunks: list[tuple[list[int], list[tuple[float, float, list[dict]]]]] = []
    for start in range(0, len(book_specs), chunk_page_count):
        stop = start + chunk_page_count
        chunks.append((ordered_page_indices[start:stop], book_specs[start:stop]))
    return chunks


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "").strip() or default)
    except Exception:
        return int(default)


__all__ = [
    "DEFAULT_CHUNK_PAGE_COUNT",
    "MIN_CHUNKED_OVERLAY_PAGES",
    "OverlayChunkCompileResult",
    "compile_book_overlay_pdf_chunks",
    "should_use_chunked_overlay_compile",
]
