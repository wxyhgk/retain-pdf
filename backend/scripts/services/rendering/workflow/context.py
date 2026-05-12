from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from foundation.config import fonts
from foundation.config import runtime


@dataclass(frozen=True)
class RenderExecutionContext:
    output_pdf_path: Path
    start_page: int
    end_page: int
    compile_workers: int | None = None
    api_key: str = ""
    model: str = ""
    base_url: str = ""
    typst_font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY
    pdf_compress_dpi: int = runtime.DEFAULT_PDF_COMPRESS_DPI
