from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from pathlib import Path
import time
from typing import Callable

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.output.typst.overlay_compile import compile_page_overlay_pdf
from retainpdf_pipeline.render.output.typst.shared import default_compile_workers
from retainpdf_pipeline.services.pipeline_shared.events import emit_render_page_progress

OverlayPageSpec = tuple[int, float, float, list[dict], str]
TypstRepairRequestFn = Callable[..., str]


def compile_overlay_page_specs(
    page_specs: list[OverlayPageSpec],
    *,
    compile_workers: int | None = None,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    temp_root: Path | None = None,
    request_chat_content_fn: TypstRepairRequestFn | None = None,
) -> tuple[dict[int, Path], dict[int, dict[str, object]], float]:
    overlay_paths: dict[int, Path] = {}
    page_compile_diagnostics: dict[int, dict[str, object]] = {}
    max_workers = compile_workers or default_compile_workers(len(page_specs))
    compile_started = time.perf_counter()

    def _compile_page(
        page_idx: int,
        page_width: float,
        page_height: float,
        items: list[dict],
        page_stem: str,
    ) -> tuple[Path, dict[str, object]]:
        compile_diag: dict[str, object] = {"page_index": page_idx, "stem": page_stem}
        path = compile_page_overlay_pdf(
            page_width=page_width,
            page_height=page_height,
            translated_items=items,
            stem=page_stem,
            api_key=api_key,
            model=model,
            base_url=base_url,
            font_family=font_family,
            font_paths=font_paths,
            temp_root=temp_root,
            diagnostics=compile_diag,
            request_chat_content_fn=request_chat_content_fn,
        )
        return path, compile_diag

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                _compile_page,
                page_idx,
                page_width,
                page_height,
                items,
                page_stem,
            ): (page_idx, page_stem)
            for page_idx, page_width, page_height, items, page_stem in page_specs
        }
        completed = 0
        total_pages = len(future_map)
        for future in as_completed(future_map):
            page_idx, page_stem = future_map[future]
            try:
                overlay_path, compile_diag = future.result()
            except RuntimeError as exc:
                raise RuntimeError(f"page overlay compile failed page={page_idx + 1} stem={page_stem}: {exc}") from exc
            overlay_paths[page_idx] = overlay_path
            page_compile_diagnostics[page_idx] = compile_diag
            completed += 1
            emit_render_page_progress(
                current=completed,
                total=total_pages,
                message=f"正在编译页面 overlay，第 {completed}/{total_pages} 页",
                payload={
                    "render_stage": "page_overlay_compile",
                    "page_index": page_idx,
                },
            )

    return overlay_paths, page_compile_diagnostics, time.perf_counter() - compile_started
