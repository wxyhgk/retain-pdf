from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.render.render_inputs import RenderInputs
from retainpdf_pipeline.render.render_mode import resolve_effective_render_mode
from retainpdf_pipeline.render.translation_loader import load_translated_pages
from retainpdf_pipeline.render.translation_loader import select_translated_pages


@dataclass(frozen=True)
class RenderPlan:
    render_inputs: RenderInputs
    selected_pages: dict[int, list[dict]]
    effective_render_mode: str

    @property
    def render_total(self) -> int:
        return len(self.selected_pages)


def plan_pages(
    *,
    source_pdf_path: Path,
    pages: dict[int, list[dict]],
    mode_probe_pages: dict[int, list[dict]] | None,
    start_page: int,
    end_page: int,
    render_mode: str,
) -> tuple[dict[int, list[dict]], str]:
    """要渲染的页与实际渲染模式。渲染阶段与提前做的渲染准备（翻译前的条目）共用这一份推导。"""
    effective_render_mode = resolve_effective_render_mode(
        render_mode=render_mode,
        source_pdf_path=source_pdf_path,
        start_page=start_page,
        end_page=end_page,
        translated_pages_map=mode_probe_pages,
    )
    selected_pages = select_translated_pages(
        pages,
        start_page=max(0, start_page),
        end_page=max(pages) if end_page < 0 else end_page,
    )
    return selected_pages, effective_render_mode


def build_render_plan(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    translations_dir: Path | None = None,
    translation_manifest_path: Path | None = None,
    start_page: int,
    end_page: int,
    render_mode: str,
    translated_pages_map: dict[int, list[dict]] | None = None,
) -> RenderPlan:
    from retainpdf_pipeline.render.render_inputs import resolve_render_inputs

    render_inputs = resolve_render_inputs(
        source_pdf_path=source_pdf_path,
        translations_dir=translations_dir,
        translation_manifest_path=translation_manifest_path,
    )
    auto_pages_map = translated_pages_map
    if render_mode == "auto" and auto_pages_map is None:
        auto_pages_map = load_translated_pages(
            render_inputs.translations_dir,
            manifest_path=render_inputs.translation_manifest_path,
        )
    pages = (
        auto_pages_map
        if auto_pages_map is not None
        else load_translated_pages(
            render_inputs.translations_dir,
            manifest_path=render_inputs.translation_manifest_path,
        )
    )
    selected_pages, effective_render_mode = plan_pages(
        source_pdf_path=render_inputs.source_pdf_path,
        pages=pages,
        mode_probe_pages=auto_pages_map,
        start_page=start_page,
        end_page=end_page,
        render_mode=render_mode,
    )
    return RenderPlan(
        render_inputs=render_inputs,
        selected_pages=selected_pages,
        effective_render_mode=effective_render_mode,
    )
