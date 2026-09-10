from __future__ import annotations

from pathlib import Path
import time

import fitz


def save_optimized_pdf(doc: fitz.Document, output_pdf_path: Path) -> None:
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    print("save optimized pdf: subset fonts", flush=True)
    doc.subset_fonts()
    print(f"save optimized pdf: writing {output_pdf_path}", flush=True)
    doc.save(
        output_pdf_path,
        garbage=4,
        deflate=True,
        deflate_images=True,
        deflate_fonts=True,
        use_objstms=1,
    )
    print(f"save optimized pdf: done {output_pdf_path}", flush=True)


def save_fast_pdf(doc: fitz.Document, output_pdf_path: Path) -> None:
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    print(f"save fast pdf: writing {output_pdf_path}", flush=True)
    doc.save(output_pdf_path)
    print(f"save fast pdf: done {output_pdf_path} elapsed={time.perf_counter() - started:.2f}s", flush=True)


def strip_page_links(page: fitz.Page) -> None:
    return
