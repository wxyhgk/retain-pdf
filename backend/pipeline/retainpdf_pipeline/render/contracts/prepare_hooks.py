"""渲染准备步骤的注入点。

source / source_cleanup 层做具体的事（采样、去文字层……），但不能依赖 prepare 层的缓存；
workflow 用 render.prepare.hooks.prepare_hooks(prepare_dir) 造一份，顺着调用链传下去。
某项为 None 就是原来的现做。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class RenderPrepareHooks:
    # (source_pdf_path, pages) -> DocumentVisualProfile
    visual_profile: Callable | None = None
    # (source_pdf_path, *, strip_hidden_text, start_page, end_page) -> RenderSourceBase
    source_base: Callable | None = None
    # (execute, **按框去文字的参数) -> BBoxTextStripResult；execute 是原本的执行函数
    text_strip: Callable | None = None


__all__ = ["RenderPrepareHooks"]
