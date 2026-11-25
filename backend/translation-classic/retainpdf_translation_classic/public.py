"""普通翻译引擎给流水线用的稳定门面（2026-11-20 拆包：以前在 retainpdf_translation.public，底座的门面不该导出引擎的东西）。

延迟导出，和底座的 public 一样：登记在 `_EXPORTS`，用到时才 import。
"""

from __future__ import annotations

from importlib import import_module

_EXPORTS = {
    "run_refine_for_render": (
        "retainpdf_translation_classic.workflow.refine",
        "run_refine_for_render",
    ),
    # 表格翻译（T3）2026-11-25 搬进了表格 agent 包 backend/table-agent（retainpdf_table_agent、
    # retainpdf_table_agent_engine），流水线直接从那里 import。
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    target = _EXPORTS.get(name)
    if target is None:
        raise AttributeError(name)
    module_name, attr_name = target
    value = getattr(import_module(module_name), attr_name)
    globals()[name] = value
    return value
