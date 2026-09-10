from __future__ import annotations


# translation_diagnostics 的统一写入口(修复链专用,逐步推广)。
#
# 契约:
# - 顶层保持 dict、覆盖式 merge,与现有读方(前端调试面板、Rust 视图、
#   debug index、replay 工具)完全兼容;
# - 每次写入同时把本次 updates 追加进 diagnostics["history"],
#   保留各阶段处理轨迹——此前 route_path/degradation_reason/fallback_to
#   等单值字段被后续阶段覆盖后,历史即丢失;
# - 写入前重读 item 上的当前 diagnostics,避免"先构造快照、中间别人
#   写入、再整段回写"造成的静默覆盖。


def record_translation_diagnostics(item: dict, stage: str, updates: dict) -> dict:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    diagnostics.update(updates)
    history = list(diagnostics.get("history") or [])
    history.append({"stage": str(stage or ""), **updates})
    diagnostics["history"] = history
    item["translation_diagnostics"] = diagnostics
    return diagnostics


__all__ = ["record_translation_diagnostics"]
