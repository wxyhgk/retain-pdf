"""把各准备步骤组装成注入点（contracts.prepare_hooks.RenderPrepareHooks），交给 source 层用。"""

from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.render.contracts.prepare_hooks import RenderPrepareHooks
from retainpdf_pipeline.render.prepare.source_base import source_base_builder
from retainpdf_pipeline.render.prepare.text_strip import text_strip_runner
from retainpdf_pipeline.render.prepare.visual_profile import visual_profile_builder


def prepare_hooks(prepare_dir: Path | None) -> RenderPrepareHooks | None:
    """prepare_dir 为 None（no_cache / 没有任务目录）时返回 None：全部现做。"""
    if prepare_dir is None:
        return None
    return RenderPrepareHooks(
        visual_profile=visual_profile_builder(prepare_dir),
        source_base=source_base_builder(prepare_dir),
        text_strip=text_strip_runner(prepare_dir),
    )


__all__ = ["prepare_hooks"]
