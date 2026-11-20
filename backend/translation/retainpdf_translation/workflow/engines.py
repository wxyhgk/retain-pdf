"""翻译引擎登记表（2026-11-20 拆包第 1 步）。

执行入口（`execution_runner`）、执行计划（`execution_plan`）是底座，两种引擎共用；引擎自己的东西按任务的
`translation.engine` 从这里查，写成「模块:函数」的字符串，用到时才加载。底座因此不静态 import 任何一个引擎，
架构检查（`translation_engines.py`）卡着这一点；以后普通翻译搬进 `retainpdf-translation-classic`、agent 接线搬进
`backend/translation-agent`，只改这里的路径。
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class EngineSpec:
    # 整本翻译：(data, output_dir, page_indices, …) -> (页 → 记录, 每页小结)
    translate_book: str
    # 跟着 OCR 流式翻（只有普通翻译有）；空串表示这个引擎不支持，按整本翻
    translate_book_streaming: str = ""
    # 译前准备（术语预扫、术语审定、风格指南），translation.preparation 不是 off 时才调；空串表示不支持
    run_preparation: str = ""
    # 实际的批大小（写进运行诊断）；空串就用请求里的 batch_size
    effective_batch_size: str = ""


ENGINES: dict[str, EngineSpec] = {
    "legacy": EngineSpec(
        translate_book="retainpdf_translation_classic.workflow.book_flow:translate_book_with_global_continuations",
        translate_book_streaming="retainpdf_translation_classic.workflow.streaming_flow:translate_book_streaming",
        run_preparation="retainpdf_translation_classic.workflow.preparation_step:run_translation_preparation",
        effective_batch_size="retainpdf_translation_classic.workflow.batching.plan:effective_translation_batch_size",
    ),
    "agent": EngineSpec(
        translate_book="retainpdf_translation.workflow.agent_flow:translate_book_with_agent",
    ),
}


def engine_spec(name: str) -> EngineSpec:
    try:
        return ENGINES[name]
    except KeyError:
        raise ValueError(f"unknown translation engine {name!r} (expected one of {', '.join(ENGINES)})") from None


def load(ref: str) -> Any:
    """「模块:名字」→ 那个对象。每次都现查（测试替换模块属性也认）。"""
    module, _, attr = ref.partition(":")
    return getattr(importlib.import_module(module), attr)


__all__ = ["ENGINES", "EngineSpec", "engine_spec", "load"]
