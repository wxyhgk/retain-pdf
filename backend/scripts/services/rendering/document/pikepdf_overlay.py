from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

import pikepdf


@dataclass(frozen=True)
class PikepdfOverlayResult:
    output_pdf_path: Path
    pages_merged: int
    elapsed_seconds: float


def _page_media_rect(page: pikepdf.Page) -> pikepdf.Rectangle:
    box = page.mediabox
    return pikepdf.Rectangle(float(box[0]), float(box[1]), float(box[2]), float(box[3]))


def _page_crop_rect(page: pikepdf.Page) -> pikepdf.Rectangle:
    box = page.cropbox
    return pikepdf.Rectangle(float(box[0]), float(box[1]), float(box[2]), float(box[3]))


def overlay_pdf_pages_with_pikepdf(
    *,
    source_pdf_path: Path,
    overlay_pdf_path: Path,
    output_pdf_path: Path,
    source_page_indices: list[int] | None = None,
) -> PikepdfOverlayResult:
    started = time.perf_counter()
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with pikepdf.Pdf.open(source_pdf_path) as pdf, pikepdf.Pdf.open(overlay_pdf_path) as overlay_pdf:
        page_indices = source_page_indices or list(range(min(len(pdf.pages), len(overlay_pdf.pages))))
        pages_merged = 0
        for overlay_page_idx, source_page_idx in enumerate(page_indices):
            if source_page_idx < 0 or source_page_idx >= len(pdf.pages):
                continue
            if overlay_page_idx < 0 or overlay_page_idx >= len(overlay_pdf.pages):
                continue
            source_page = pdf.pages[source_page_idx]
            source_page.add_overlay(
                overlay_pdf.pages[overlay_page_idx],
                rect=_page_crop_rect(source_page),
                push_stack=True,
                shrink=False,
                expand=False,
            )
            pages_merged += 1
        pdf.save(
            output_pdf_path,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            compress_streams=True,
            recompress_flate=False,
        )
    return PikepdfOverlayResult(
        output_pdf_path=output_pdf_path,
        pages_merged=pages_merged,
        elapsed_seconds=time.perf_counter() - started,
    )


def overlay_page_pdfs_with_pikepdf(
    *,
    source_pdf_path: Path,
    overlay_paths_by_page_index: dict[int, Path],
    output_pdf_path: Path,
) -> PikepdfOverlayResult:
    started = time.perf_counter()
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with pikepdf.Pdf.open(source_pdf_path) as pdf:
        pages_merged = 0
        for source_page_idx, overlay_path in sorted(overlay_paths_by_page_index.items()):
            if source_page_idx < 0 or source_page_idx >= len(pdf.pages):
                continue
            with pikepdf.Pdf.open(overlay_path) as overlay_pdf:
                if not overlay_pdf.pages:
                    continue
                source_page = pdf.pages[source_page_idx]
                source_page.add_overlay(
                    overlay_pdf.pages[0],
                    rect=_page_crop_rect(source_page),
                    push_stack=True,
                    shrink=False,
                    expand=False,
                )
                pages_merged += 1
        pdf.save(
            output_pdf_path,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            compress_streams=True,
            recompress_flate=False,
        )
    return PikepdfOverlayResult(
        output_pdf_path=output_pdf_path,
        pages_merged=pages_merged,
        elapsed_seconds=time.perf_counter() - started,
    )
