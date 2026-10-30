"""翻译 agent 和调用方（测试系统、以后的重排 agent、正式翻译流程）之间的交接格式。

调用方只通过这里的几个类型和 agent 打交道，不碰 agent 内部；格式改了就升 `CONTRACT_VERSION`，只加不改。

- `PageInput`：一页要交给 agent 的块（翻的和只作上下文的都在里面）。
- `BlockResult`：agent 交回的一块：译文、校验问题、请求了几次、最终状态。
- `RevisionRequest`：重排 agent 发来的改稿要求（例如"这块放不下，缩到 N 字以内"）。

第 1 版（2026-10-30）只加了字段：`PageInput.chapter`、`PageInput.context`（上下文包，见 `context.py`）、
`BlockResult.meta`（谁、用哪个版本翻的）、状态 `fallback_source`。
"""

from __future__ import annotations

from dataclasses import dataclass, field

CONTRACT_VERSION = "translation_agent.v1"

STATUS_OK = "ok"
STATUS_WARN = "warn"
STATUS_ERROR = "error"
# 重翻以后还不合格：不交译文（`translation` 是 None），显示原文、待人看；没过校验的那版留在 `history` 里
STATUS_FALLBACK_SOURCE = "fallback_source"


@dataclass
class BlockInput:
    """一块。`cls` 用 RetainPDF 自己的块分类（见 docs/ops/planning/ocr-normalization/ 的分类草案）。"""

    id: str
    cls: str
    text: str
    translate: bool
    where: str = ""
    cls_label: str = ""
    source_lang: str = "en"
    # 接续组：被分栏、分页拆开的同一段话，{"id": 组号, "index": 第几块（从 1 数）, "of": 共几块}
    group: dict | None = None
    relations: dict = field(default_factory=dict)
    attributes: dict = field(default_factory=dict)

    def request_record(self) -> dict:
        record = {"id": self.id, "class": self.cls, "where": self.where, "text": self.text, "translate": self.translate}
        if self.cls_label:
            record["class_label"] = self.cls_label
        if self.group:
            record["group"] = self.group
        if self.relations:
            record["relations"] = self.relations
        if self.attributes:
            record["attributes"] = self.attributes
        if self.source_lang != "en":
            record["source_lang"] = self.source_lang
        return record


@dataclass
class PageInput:
    page_label: str
    blocks: list[BlockInput]
    section_path: list[str] = field(default_factory=list)
    document: dict = field(default_factory=dict)  # {"title", "source_lang", "target_lang"}
    # 这一页属于哪一章（术语的作用域按它算）；空字符串是不分章
    chapter: str = ""
    # 上下文包：术语、保留原文、缩写、相邻页、风格、摘要（`context.build_context` 造），原样放进请求
    context: dict = field(default_factory=dict)

    def to_translate(self) -> list[BlockInput]:
        return [b for b in self.blocks if b.translate]


@dataclass
class BlockResult:
    id: str
    translation: str | None
    issues: list[dict]
    attempts: int
    status: str
    history: list[dict] = field(default_factory=list)
    # 模型、提示词版本、交接格式版本、角色、轮次、术语表版本、used_terms（[[术语 id, 版本], …]）、上下文包哈希
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        out = {
            "id": self.id,
            "translation": self.translation,
            "issues": self.issues,
            "attempts": self.attempts,
            "status": self.status,
            "history": self.history,
        }
        if self.meta:
            out["meta"] = self.meta
        return out


@dataclass
class RevisionRequest:
    """改稿要求。`max_chars` 是改完后译文最多显示多少字：脚注标记算 1 个字，公式按源码长度的一半估（见 `checks.visible_length`）。"""

    id: str
    current_translation: str
    reason: str = "overflow"
    max_chars: int | None = None
    note: str = ""
