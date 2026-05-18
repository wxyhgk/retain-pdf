from __future__ import annotations

from pathlib import Path
import shutil
import time

import fitz
import pikepdf
from pikepdf import Name

from services.rendering.source.preparation.bbox_text_strip_engine import strip_bbox_text_from_page
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripResult


def strip_bbox_text_rects_from_pdf_copy(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    page_rects: dict[int, list[fitz.Rect]],
    page_protected_rects: dict[int, list[fitz.Rect]] | None = None,
    recurse_forms: bool | None = None,
    skipped_complex: int = 0,
    skipped_no_text_overlap: int = 0,
    skipped_complex_page_indices: frozenset[int] = frozenset(),
    skipped_no_text_overlap_page_indices: frozenset[int] = frozenset(),
    candidate_elapsed: float = 0.0,
) -> BBoxTextStripResult:
    page_protected_rects = page_protected_rects or {}
    if not page_rects:
        return BBoxTextStripResult(
            changed=False,
            pages_skipped_complex=skipped_complex,
            pages_skipped_no_text_overlap=skipped_no_text_overlap,
            skipped_complex_page_indices=frozenset(skipped_complex_page_indices),
            skipped_no_text_overlap_page_indices=frozenset(skipped_no_text_overlap_page_indices),
        )

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    copy_started = time.perf_counter()
    shutil.copy2(source_pdf_path, output_pdf_path)
    copy_elapsed = time.perf_counter() - copy_started

    pages_changed = 0
    changed_page_indices: set[int] = set()
    removed_total = 0
    forms_changed_total = 0
    parse_elapsed = 0.0
    save_elapsed = 0.0
    effective_recurse_forms = True if recurse_forms is None else recurse_forms
    with pikepdf.Pdf.open(output_pdf_path, allow_overwriting_input=True) as pdf:
        for page_idx, rects in page_rects.items():
            parse_started = time.perf_counter()
            content_stream, removed, forms_changed = strip_bbox_text_from_page(
                pdf.pages[page_idx],
                rects,
                protected_rects=page_protected_rects.get(page_idx, []),
                recurse_forms=effective_recurse_forms,
            )
            parse_elapsed += time.perf_counter() - parse_started
            forms_changed_total += forms_changed
            if not content_stream or removed <= 0:
                if forms_changed > 0:
                    pages_changed += 1
                    changed_page_indices.add(page_idx)
                    removed_total += removed
                continue
            pdf.pages[page_idx].obj[Name("/Contents")] = pdf.make_stream(content_stream)
            pages_changed += 1
            changed_page_indices.add(page_idx)
            removed_total += removed

        if pages_changed <= 0:
            output_pdf_path.unlink(missing_ok=True)
            return BBoxTextStripResult(
                changed=False,
                pages_skipped_complex=skipped_complex,
                pages_skipped_no_text_overlap=skipped_no_text_overlap,
                skipped_complex_page_indices=frozenset(skipped_complex_page_indices),
                skipped_no_text_overlap_page_indices=frozenset(skipped_no_text_overlap_page_indices),
            )

        save_started = time.perf_counter()
        pdf.save(
            output_pdf_path,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            compress_streams=True,
            recompress_flate=False,
        )
        save_elapsed = time.perf_counter() - save_started

    print(
        f"bbox text strip: mode=strip pages={pages_changed} text_show_ops={removed_total} "
        f"forms={forms_changed_total} skipped_complex_pages={skipped_complex} "
        f"skipped_no_text_overlap_pages={skipped_no_text_overlap} "
        f"copy={copy_elapsed:.2f}s candidates={candidate_elapsed:.2f}s parse={parse_elapsed:.2f}s save={save_elapsed:.2f}s "
        f"output={output_pdf_path}",
        flush=True,
    )
    return BBoxTextStripResult(
        changed=True,
        output_pdf_path=output_pdf_path,
        pages_changed=pages_changed,
        text_show_ops_removed=removed_total,
        pages_skipped_complex=skipped_complex,
        pages_skipped_no_text_overlap=skipped_no_text_overlap,
        forms_changed=forms_changed_total,
        changed_page_indices=frozenset(changed_page_indices),
        skipped_complex_page_indices=frozenset(skipped_complex_page_indices),
        skipped_no_text_overlap_page_indices=frozenset(skipped_no_text_overlap_page_indices),
    )
