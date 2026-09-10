from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from retainpdf_pipeline.translate.core.item_reader import item_block_class
from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_effective_role
from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_compatible, item_is_title_like
from retainpdf_pipeline.translate.core.text_rules import structure_style_hint


_CONTEXT_PLACEHOLDER_RE = re.compile(r"<[a-z]\d+-[0-9a-z]{3}/>|@@P\d+@@|\[\[FORMULA_\d+]]")


def sanitize_prompt_context_text(text: str) -> str:
    sanitized = _CONTEXT_PLACEHOLDER_RE.sub(" ", str(text or ""))
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized


def _merge_context_text(*values: object) -> str:
    parts = [sanitize_prompt_context_text(str(value or "")) for value in values]
    return " ".join(part for part in parts if part).strip()


def _line_texts(lines: list[dict]) -> list[str]:
    return [" ".join(span.get("content", "") for span in line.get("spans", [])).strip() for line in lines]


def _count_inline_formulas(segments: list[dict]) -> int:
    return sum(1 for segment in segments if segment.get("type") == "inline_equation")


def _is_structured_line_context(*, text_flow: str, semantic_role: str, structure_role: str, toc_entries: list[dict[str, Any]]) -> bool:
    if str(structure_role or "").strip().lower() == "table_of_contents" or toc_entries:
        return True
    if str(semantic_role or "").strip().lower() in {"body", "abstract"}:
        return False
    return str(text_flow or "").strip().lower() == "preserve_lines"


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
    block_class: str = "unknown"
    layout_role: str = ""
    semantic_role: str = ""
    effective_role: str = "body"
    bbox: list[float] | None = None
    line_count: int = 0
    lines: list[dict] | None = None
    line_texts: list[str] | None = None
    text_flow: str = "flow"
    has_inline_formula: bool = False
    math_mode: str = "placeholder"
    style_hint: str = ""
    continuation_group: str = ""
    context_before: str = ""
    context_after: str = ""
    metadata: dict[str, Any] | None = None
    toc_entries: list[dict[str, Any]] | None = None
    raw_item: dict[str, Any] | None = None
    scoped_terms_guidance: str = field(init=False, default="")
    prompt_is_reference: bool = field(init=False, default=False)
    prompt_is_title: bool = field(init=False, default=False)
    prompt_member_ids: tuple[str, ...] = field(init=False, default=())
    prompt_member_sources: tuple[tuple[str, str], ...] = field(init=False, default=())
    prompt_raw_direct_typst: bool = field(init=False, default=False)
    prompt_member_ids_error: str | None = field(init=False, default=None)
    prompt_member_sources_error: str | None = field(init=False, default=None)

    def __post_init__(self) -> None:
        # Snapshot only the historical prompt reads. Keep raw_item for callers
        # that still need it, including direct construction of this context.
        raw = self.raw_item or {}
        # Optional group metadata must not make ordinary single-item context
        # construction fail. This is extraction, not member-protocol validation.
        member_ids_error = members_error = None
        try:
            member_ids = tuple(raw.get("translation_unit_member_ids", []))
        except TypeError as exc:
            member_ids, member_ids_error = (), str(exc)
        try:
            members = tuple(raw.get("translation_unit_members", []))
        except TypeError as exc:
            members, members_error = (), str(exc)
        values = {
            "scoped_terms_guidance": str(raw.get("_scoped_terms_guidance", "") or "").strip(),
            "prompt_is_reference": item_is_reference_compatible(raw),
            "prompt_is_title": item_is_title_like(raw),
            "prompt_member_ids": tuple(
                str(member_id or "").strip()
                for member_id in member_ids
                if str(member_id or "").strip()
            ),
            "prompt_member_sources": tuple(
                (str(member.get("item_id", "") or "").strip(),
                 str(member.get("protected_source_text", "") or member.get("source_text", "") or "").strip())
                for member in members
                if isinstance(member, dict) and str(member.get("item_id", "") or "").strip()
            ),
            "prompt_raw_direct_typst": str(raw.get("math_mode", "") or "").strip() == "direct_typst",
            "prompt_member_ids_error": member_ids_error,
            "prompt_member_sources_error": members_error,
        }
        for name, value in values.items():
            object.__setattr__(self, name, value)

    @property
    def preserve_line_structure_for_prompt(self) -> bool:
        return _is_structured_line_context(
            text_flow=self.text_flow,
            semantic_role=self.semantic_role,
            structure_role=str((self.metadata or {}).get("structure_role", "") or ""),
            toc_entries=list(self.toc_entries or []),
        )

    def source_for_prompt(self) -> str:
        if self.preserve_line_structure_for_prompt and self.line_texts:
            return "\n".join(line for line in self.line_texts if line.strip())
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
        if self.preserve_line_structure_for_prompt and self.line_texts:
            payload["text_flow"] = "preserve_lines"
            payload["line_count"] = len(self.line_texts)
            payload["instruction"] = "保持原文多行结构，译文尽量使用相同换行数量和行序。"
        if self.toc_entries:
            payload["structure"] = "table_of_contents"
            payload["instruction"] = "这是目录页内容。逐行翻译标题，保留章节编号、点线省略号和页码的位置关系，不要合并行。"
        if self.continuation_group:
            payload["continuation_group"] = self.continuation_group
        context_before = self.context_before_for_prompt()
        context_after = self.context_after_for_prompt()
        if context_before:
            payload["context_before"] = f"仅供理解，禁止翻译进输出：{context_before}"
        if context_after:
            payload["context_after"] = f"仅供理解，禁止翻译进输出：{context_after}"
        return payload

    def as_classification_record(self, *, rule_label: str = "") -> dict[str, Any]:
        record = {
            "order": self.order,
            "item_id": self.item_id,
            "block_type": self.block_type or self.block_kind,
            "block_kind": self.block_kind,
            "block_class": self.block_class,
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
        if self.toc_entries:
            record["toc_entries"] = list(self.toc_entries)
        if rule_label:
            record["rule_label"] = rule_label
        return record


def build_item_context(item: dict[str, Any], *, order: int = 0, page_idx: int | None = None) -> TranslationItemContext:
    lines = list(item.get("lines", []) or [])
    source_text = str(item.get("source_text", "") or "")
    explicit_line_texts = [
        str(line).strip()
        for line in item.get("source_line_texts", [])
        if str(line).strip()
    ]
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
        "block_class": item.get("block_class", ""),
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
    context_mode = str(item.get("translation_context_mode", "needed") or "needed").strip().lower()
    include_continuation_context = context_mode != "off"
    return TranslationItemContext(
        item_id=str(item.get("item_id", "") or ""),
        page_idx=resolved_page_idx,
        order=order,
        source_text=source_text,
        protected_source_text=protected_source_text,
        block_type=item_block_kind(payload_for_roles),
        block_kind=item_block_kind(payload_for_roles),
        block_class=item_block_class(payload_for_roles),
        layout_role=item_layout_role(payload_for_roles),
        semantic_role=item_semantic_role(payload_for_roles),
        effective_role=item_effective_role(payload_for_roles) or "body",
        bbox=list(item.get("bbox", []) or []),
        line_count=len(lines),
        lines=lines,
        line_texts=explicit_line_texts or _line_texts(lines),
        text_flow=str(item.get("text_flow", "") or "flow").strip().lower() or "flow",
        toc_entries=list(item.get("toc_entries", []) or []),
        has_inline_formula=bool(formula_map) or _count_inline_formulas(segments) > 0,
        math_mode=str(item.get("math_mode", "placeholder") or "placeholder").strip() or "placeholder",
        style_hint=structure_style_hint(item),
        continuation_group=str(item.get("continuation_group", "") or ""),
        context_before=_merge_context_text(
            item.get("translation_context_before", ""),
            item.get("continuation_prev_text", "") if include_continuation_context else "",
        ),
        context_after=_merge_context_text(
            item.get("continuation_next_text", "") if include_continuation_context else "",
            item.get("translation_context_after", ""),
        ),
        metadata=dict(item.get("metadata", {}) or {}),
        raw_item=item,
    )


def build_page_item_contexts(payload: list[dict[str, Any]], *, page_idx: int | None = None) -> list[TranslationItemContext]:
    return [build_item_context(item, order=order, page_idx=page_idx) for order, item in enumerate(payload, start=1)]
