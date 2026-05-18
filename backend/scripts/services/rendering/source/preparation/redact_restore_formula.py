from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

from services.rendering.source.preparation.bbox_text_strip import build_bbox_text_stripped_pdf_copy


def _translated_page_indices(translated_pages: dict[int, list[dict]]) -> frozenset[int]:
    return frozenset(page_idx for page_idx, items in translated_pages.items() if page_idx >= 0 and items)


@dataclass(frozen=True)
class RedactRestoreFormulaResult:
    changed: bool
    output_pdf_path: Path | None = None
    pages_changed: int = 0
    redaction_rects: int = 0
    formula_rects_restored: int = 0
    changed_page_indices: frozenset[int] = frozenset()


def build_redact_restore_formula_pdf_copy(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
) -> RedactRestoreFormulaResult:
    started = time.perf_counter()
    result = build_bbox_text_stripped_pdf_copy(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        translated_pages=translated_pages,
        skip_formula_pages=False,
    )

    print(
        f"redact-restore formulas: pikepdf text strip pages={result.pages_changed} "
        f"text_show_ops={result.text_show_ops_removed} forms={result.forms_changed} "
        f"elapsed={time.perf_counter() - started:.2f}s output={output_pdf_path}",
        flush=True,
    )
    return RedactRestoreFormulaResult(
        changed=result.changed,
        output_pdf_path=result.output_pdf_path,
        pages_changed=result.pages_changed,
        redaction_rects=result.text_show_ops_removed,
        formula_rects_restored=0,
        changed_page_indices=result.changed_page_indices | result.skipped_no_text_overlap_page_indices | _translated_page_indices(translated_pages),
    )
