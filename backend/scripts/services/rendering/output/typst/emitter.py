from __future__ import annotations

import os
from pathlib import Path

from foundation.config import fonts
from services.rendering.layout.model.block_view import layout_block_to_render_block
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.output.typst import block_config as typst_config
from services.rendering.output.typst.fit_helpers import page_spec_fit_helpers
from services.rendering.output.typst.block_renderer import build_typst_block
from services.pipeline_shared.events import emit_render_page_progress


def build_typst_source_from_page_specs(
    *,
    background_pdf_path: Path,
    page_specs: list[RenderPageSpec],
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
) -> str:
    source_rel = os.path.relpath(background_pdf_path, work_dir)
    lines = [
        f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)',
    ]
    lines.extend(typst_config.typst_package_imports())
    lines.extend(page_spec_fit_helpers())

    total_pages = len(page_specs)
    for page_offset, spec in enumerate(page_specs):
        background_page_index = spec.background_page_index if spec.background_page_index is not None else spec.page_index
        page_fill = "white" if spec.is_flow_continuation or background_page_index < 0 else "none"
        lines.append(
            f"#set page(width: {spec.page_width_pt}pt, height: {spec.page_height_pt}pt, margin: 0pt, fill: {page_fill})"
        )
        if background_page_index >= 0:
            lines.append(
                f'#place(top + left, dx: 0pt, dy: 0pt, image("{source_rel}", page: {background_page_index + 1}, width: {spec.page_width_pt}pt))'
            )
        for block_index, block in enumerate(spec.blocks):
            block_id = f"rp{page_offset}_{block.block_id}_{block_index}"
            lines.append(build_typst_block(block_id, layout_block_to_render_block(block), include_fill=True))
        if page_offset + 1 < len(page_specs):
            lines.append("#pagebreak()")
        emit_render_page_progress(
            current=page_offset + 1,
            total=total_pages,
            message=f"正在生成 Typst 页面，第 {page_offset + 1}/{total_pages} 页",
            payload={
                "render_stage": "typst_source_build",
                "page_index": spec.source_page_index if spec.source_page_index is not None else spec.page_index,
                "substage": "render_pages",
                "flow_continuation": spec.is_flow_continuation,
            },
        )
    return "\n".join(lines) + "\n"
