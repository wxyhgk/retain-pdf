from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from services.translation.item_reader import item_block_kind
from services.translation.item_reader import item_effective_role
from services.translation.item_reader import item_layout_role
from services.translation.item_reader import item_semantic_role
from services.translation.llm.style_hints import structure_style_hint


_CONTEXT_PLACEHOLDER_RE = re.compile(r"<[a-z]\d+-[0-9a-z]{3}/>|@@P\d+@@|\[\[FORMULA_\d+]]")


def sanitize_prompt_context_text(text: str) -> str:
    sanitized = _CONTEXT_PLACEHOLDER_RE.sub(" ", str(text or ""))
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized


def _line_texts(lines: list[dict]) -> list[str]:
    return [" ".join(span.get("content", "") for span in line.get("spans", [])).strip() for line in lines]


def _count_inline_formulas(segments: list[dict]) -> int:
    return sum(1 for segment in segments if segment.get("type") == "inline_equation")


@dataclass(frozen=True)
class TranslationDocumentContext:
    mode: str = "fast"
    target_language: str = "zh-CN"
    domain_guidance: str = ""
    rule_guidance: str = ""
    glossary_guidance: str = ""


@dataclass(frozen=True)
class TranslationItemContext:
    item_id: str
    source_text: str
    protected_source_text: str
    page_idx: int = 0
    order: int = 0
    block_type: str = ""
    block_kind: str = "unknown"
    layout_role: str = ""
    semantic_role: str = ""
    effective_role: str = "body"
    bbox: list[float] | None = None
    line_count: int = 0
    lines: list[dict] | None = None
    line_texts: list[str] | None = None
    has_inline_formula: bool = False
    math_mode: str = "placeholder"
    style_hint: str = ""
    continuation_group: str = ""
    context_before: str = ""
    context_after: str = ""
    metadata: dict[str, Any] | None = None
    raw_item: dict[str, Any] | None = None

    def source_for_prompt(self) -> str:
        return self.protected_source_text

    def context_before_for_prompt(self) -> str:
        return sanitize_prompt_context_text(self.context_before)

    def context_after_for_prompt(self) -> str:
        return sanitize_prompt_context_text(self.context_after)

    def source_for_context(self) -> str:
        return sanitize_prompt_context_text(self.protected_source_text)

    def as_batch_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "item_id": self.item_id,
            "source_text": self.source_for_prompt(),
        }
        if self.style_hint:
            payload["style_hint"] = self.style_hint
        if self.continuation_group:
            payload["continuation_group"] = self.continuation_group
            context_before = self.context_before_for_prompt()
            context_after = self.context_after_for_prompt()
            if context_before:
                payload["context_before"] = context_before
            if context_after:
                payload["context_after"] = context_after
        return payload

    def as_classification_record(self, *, rule_label: str = "") -> dict[str, Any]:
        record = {
            "order": self.order,
            "item_id": self.item_id,
            "block_type": self.block_type or self.block_kind,
            "block_kind": self.block_kind,
            "layout_role": self.layout_role,
            "semantic_role": self.semantic_role,
            "effective_role": self.effective_role or "body",
            "bbox": list(self.bbox or []),
            "source_text": self.source_text,
            "line_count": self.line_count,
            "lines": list(self.lines or []),
            "line_texts": list(self.line_texts or []),
            "has_inline_formula": self.has_inline_formula,
            "metadata": dict(self.metadata or {}),
        }
        if rule_label:
            record["rule_label"] = rule_label
        return record


def build_item_context(item: dict[str, Any], *, order: int = 0, page_idx: int | None = None) -> TranslationItemContext:
    lines = list(item.get("lines", []) or [])
    source_text = str(item.get("source_text", "") or "")
    protected_source_text = str(
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or source_text
        or ""
    )
    resolved_page_idx = item.get("page_idx", 0) if page_idx is None else page_idx
    try:
        resolved_page_idx = int(resolved_page_idx)
    except Exception:
        resolved_page_idx = 0
    payload_for_roles = {
        "block_type": item.get("block_type", ""),
        "block_kind": item.get("block_kind", item.get("block_type", "")),
        "layout_role": item.get("layout_role", ""),
        "semantic_role": item.get("semantic_role", ""),
        "structure_role": item.get("structure_role", ""),
        "policy_translate": item.get("policy_translate"),
        "bbox": item.get("bbox", []),
        "source_text": source_text,
        "formula_map": item.get("formula_map"),
        "metadata": item.get("metadata", {}),
    }
    formula_map = item.get("formula_map")
    segments = list(item.get("segments", []) or [])
    return TranslationItemContext(
        item_id=str(item.get("item_id", "") or ""),
        page_idx=resolved_page_idx,
        order=order,
        source_text=source_text,
        protected_source_text=protected_source_text,
        block_type=item_block_kind(payload_for_roles),
        block_kind=item_block_kind(payload_for_roles),
        layout_role=item_layout_role(payload_for_roles),
        semantic_role=item_semantic_role(payload_for_roles),
        effective_role=item_effective_role(payload_for_roles) or "body",
        bbox=list(item.get("bbox", []) or []),
        line_count=len(lines),
        lines=lines,
        line_texts=_line_texts(lines),
        has_inline_formula=bool(formula_map) or _count_inline_formulas(segments) > 0,
        math_mode=str(item.get("math_mode", "placeholder") or "placeholder").strip() or "placeholder",
        style_hint=structure_style_hint(item),
        continuation_group=str(item.get("continuation_group", "") or ""),
        context_before=str(item.get("continuation_prev_text", "") or ""),
        context_after=str(item.get("continuation_next_text", "") or ""),
        metadata=dict(item.get("metadata", {}) or {}),
        raw_item=item,
    )


def build_page_item_contexts(payload: list[dict[str, Any]], *, page_idx: int | None = None) -> list[TranslationItemContext]:
    return [build_item_context(item, order=order, page_idx=page_idx) for order, item in enumerate(payload, start=1)]
