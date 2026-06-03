from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from foundation.config import fonts
from foundation.config import runtime
from services.rendering.layout.model.models import RenderPageSpec


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
    source_image_compressed: bool = False
    indent_detection_pdf_path: Path | None = None
    first_line_indent_lookup: dict[str, float] | None = None
    effective_inner_bbox_lookup: dict[str, list[float]] | None = None
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()
    source_cleanup_strategy: str = "pikepdf_text_strip"
    cover_fallback_page_indices: frozenset[int] = frozenset()
    flow_rebuild_page_indices: frozenset[int] = frozenset()
    background_render_page_specs: list[RenderPageSpec] | None = None
    render_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None
