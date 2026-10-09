"""精修配置：把渲染 spec 的 ``params.refine``（或一次性覆盖）归一成一份不可变配置。

取值规则（与 Rust 写 spec 的约定一致，见第二期接口约定第 3 节）：
- ``mode``：off / review_only / review_and_fix，其它值（含缺失）一律 off；
- ``trigger``：auto / manual，其它值（含缺失）按 auto（续跑时不重复花钱）；
- ``start_page`` / ``end_page``：1-based 闭区间，null / 0 / 负数 / 非数字 = 不限；
- ``max_items`` / ``max_tokens``：≥0 的整数，0 = 不限；缺失或非法用默认值；
- reviewer_* 为空时回退到翻译模型（``model`` / ``base_url`` / ``credential_ref``）。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


REFINE_MODE_OFF = "off"
REFINE_MODE_REVIEW_ONLY = "review_only"
REFINE_MODE_REVIEW_AND_FIX = "review_and_fix"
REFINE_MODES = (REFINE_MODE_OFF, REFINE_MODE_REVIEW_ONLY, REFINE_MODE_REVIEW_AND_FIX)

REFINE_TRIGGER_AUTO = "auto"
REFINE_TRIGGER_MANUAL = "manual"
REFINE_TRIGGERS = (REFINE_TRIGGER_AUTO, REFINE_TRIGGER_MANUAL)

# 默认审全书、不设上限（与 Rust 的 DEFAULT_TRANSLATION_REFINE_MAX_* 一致）；要控制花费由调用方给。
DEFAULT_REFINE_MAX_ITEMS = 0
DEFAULT_REFINE_MAX_TOKENS = 0


def normalize_refine_mode(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in REFINE_MODES else REFINE_MODE_OFF


def normalize_refine_trigger(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in REFINE_TRIGGERS else REFINE_TRIGGER_AUTO


def _optional_page(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _limit(value: Any, default: int) -> int:
    if value is None or value == "" or isinstance(value, bool):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number if number >= 0 else default


def _text(value: Any) -> str:
    return str(value or "").strip()


@dataclass(frozen=True)
class RefineConfig:
    mode: str = REFINE_MODE_OFF
    trigger: str = REFINE_TRIGGER_AUTO
    start_page: int | None = None
    end_page: int | None = None
    max_items: int = DEFAULT_REFINE_MAX_ITEMS
    max_tokens: int = DEFAULT_REFINE_MAX_TOKENS
    reviewer_model: str = ""
    reviewer_base_url: str = ""
    reviewer_credential_ref: str = ""
    # 翻译模型（定点修改用它；reviewer_* 为空时挑错也回退到它）。
    model: str = ""
    base_url: str = ""
    credential_ref: str = ""

    @property
    def enabled(self) -> bool:
        return self.mode != REFINE_MODE_OFF

    @property
    def applies_fixes(self) -> bool:
        return self.mode == REFINE_MODE_REVIEW_AND_FIX

    def page_in_scope(self, page_number: int) -> bool:
        if self.start_page is not None and page_number < self.start_page:
            return False
        if self.end_page is not None and page_number > self.end_page:
            return False
        return True

    def scope_payload(self) -> dict[str, Any]:
        return {"start_page": self.start_page, "end_page": self.end_page, "page_base": 1}


def refine_config_from_mapping(payload: Mapping[str, Any] | None) -> RefineConfig:
    data = dict(payload or {})
    return RefineConfig(
        mode=normalize_refine_mode(data.get("mode")),
        trigger=normalize_refine_trigger(data.get("trigger")),
        start_page=_optional_page(data.get("start_page")),
        end_page=_optional_page(data.get("end_page")),
        max_items=_limit(data.get("max_items"), DEFAULT_REFINE_MAX_ITEMS),
        max_tokens=_limit(data.get("max_tokens"), DEFAULT_REFINE_MAX_TOKENS),
        reviewer_model=_text(data.get("reviewer_model")),
        reviewer_base_url=_text(data.get("reviewer_base_url")),
        reviewer_credential_ref=_text(data.get("reviewer_credential_ref")),
        model=_text(data.get("model")),
        base_url=_text(data.get("base_url")),
        credential_ref=_text(data.get("credential_ref")),
    )


__all__ = [
    "DEFAULT_REFINE_MAX_ITEMS",
    "DEFAULT_REFINE_MAX_TOKENS",
    "REFINE_MODES",
    "REFINE_MODE_OFF",
    "REFINE_MODE_REVIEW_AND_FIX",
    "REFINE_MODE_REVIEW_ONLY",
    "REFINE_TRIGGERS",
    "REFINE_TRIGGER_AUTO",
    "REFINE_TRIGGER_MANUAL",
    "RefineConfig",
    "normalize_refine_mode",
    "normalize_refine_trigger",
    "refine_config_from_mapping",
]
