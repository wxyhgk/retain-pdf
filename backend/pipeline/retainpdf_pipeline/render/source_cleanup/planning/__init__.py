from __future__ import annotations

from typing import Any


_LAZY_EXPORTS = {
    "plan_source_cleanup": (
        "retainpdf_pipeline.render.source_cleanup.planning.planner",
        "plan_source_cleanup",
    ),
    "split_rect_around_guards": (
        "retainpdf_pipeline.render.source_cleanup.planning.segments",
        "split_rect_around_guards",
    ),
    "strip_segments_for_text_rect": (
        "retainpdf_pipeline.render.source_cleanup.planning.segments",
        "strip_segments_for_text_rect",
    ),
}


def __getattr__(name: str) -> Any:
    target = _LAZY_EXPORTS.get(name)
    if target is None:
        raise AttributeError(name)
    module_name, attr_name = target
    from importlib import import_module

    value = getattr(import_module(module_name), attr_name)
    globals()[name] = value
    return value


__all__ = sorted(_LAZY_EXPORTS)
