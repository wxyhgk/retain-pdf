from __future__ import annotations


# payload item 上 final_status 的唯一赋值漏斗。
#
# 状态语义:
# - ""                    尚未收口(pending)
# - "translated"          已产出译文
# - "partially_translated" 译文经降级清洗(reasoning 泄漏 salvage、邻段泄漏裁剪等)
# - "failed"              翻译失败,等待修复链兜底
# - "kept_origin"         按策略保留原文
#
# 唯一被声明禁止的转移:成功译文不得被降级为 failed。
# 修复链(乱码重建/agent repair/最终收口)只允许把 failed 拉回成功,反向为违规。
#
# v1 只观测不拦截:违规照常写入,但在 translation_diagnostics.final_status_violations
# 留下面包屑。等真实任务证明违规不再出现(或确认属 bug 修掉)后,再升级为硬拦截。

PENDING_STATUS = ""
TRANSLATED_STATUS = "translated"
PARTIALLY_TRANSLATED_STATUS = "partially_translated"
FAILED_STATUS = "failed"
KEPT_ORIGIN_STATUS = "kept_origin"

KNOWN_FINAL_STATUSES = frozenset(
    {
        PENDING_STATUS,
        TRANSLATED_STATUS,
        PARTIALLY_TRANSLATED_STATUS,
        FAILED_STATUS,
        KEPT_ORIGIN_STATUS,
    }
)

_FORBIDDEN_TRANSITIONS = frozenset(
    {
        (TRANSLATED_STATUS, FAILED_STATUS),
        (PARTIALLY_TRANSLATED_STATUS, FAILED_STATUS),
    }
)


def final_status_violation(previous: str, next_status: str) -> str:
    if next_status not in KNOWN_FINAL_STATUSES:
        return f"unknown_status:{next_status}"
    if (previous, next_status) in _FORBIDDEN_TRANSITIONS:
        return f"demotion:{previous}->{next_status}"
    return ""


def set_final_status(item: dict, status: str) -> None:
    previous = str(item.get("final_status", "") or "")
    next_status = str(status or "")
    violation = final_status_violation(previous, next_status)
    if violation:
        diagnostics = dict(item.get("translation_diagnostics") or {})
        violations = list(diagnostics.get("final_status_violations") or [])
        violations.append(violation)
        diagnostics["final_status_violations"] = violations
        item["translation_diagnostics"] = diagnostics
    item["final_status"] = next_status


__all__ = [
    "FAILED_STATUS",
    "KEPT_ORIGIN_STATUS",
    "KNOWN_FINAL_STATUSES",
    "PARTIALLY_TRANSLATED_STATUS",
    "PENDING_STATUS",
    "TRANSLATED_STATUS",
    "final_status_violation",
    "set_final_status",
]
