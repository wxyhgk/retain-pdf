from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from fnmatch import fnmatchcase
from typing import Any

from retainpdf_pipeline.ocr.document_schema.classification import (
    derive_block_class,
)
from retainpdf_pipeline.ocr.document_schema.consumer_reader import (
    ensure_normalized_document,
)
from retainpdf_pipeline.ocr.document_schema.legacy_compat import (
    ALGORITHM_ALIASES,
    CAPTION_ALIASES,
    FOOTNOTE_ALIASES,
    REFERENCE_ENTRY_ALIASES,
    REFERENCE_HEADING_ALIASES,
    legacy_aliases,
)

REPORT_SCHEMA = "block_class_decision_diff_v1"
ALLOWLIST_SCHEMA = "block_class_decision_diff_allowlist_v1"

_LEGACY_TITLE_SUB_TYPES = frozenset({"title", "heading"})
_LEGACY_CAPTION_SUB_TYPES = frozenset(
    {
        "caption",
        "figure_caption",
        "image_caption",
        "table_caption",
        "code_caption",
    }
)
_LEGACY_FOOTNOTE_SUB_TYPES = frozenset(
    {"footnote", "image_footnote", "table_footnote", "vision_footnote"}
)
_LEGACY_METADATA_SUB_TYPES = frozenset(
    {"header", "footer", "page_number", "metadata", "formula_number"}
)
_LEGACY_FORMULA_SUB_TYPES = frozenset({"formula", "display_formula"})

PREDICATE_NAMES = (
    "caption",
    "footnote",
    "reference",
    "algorithm",
    "body_candidate",
    "document_title",
)

_LEGACY_TITLE_TAGS = frozenset({"title", "heading"})
_LEGACY_CAPTION_TAGS = frozenset(
    {"caption", "figure_caption", "image_caption", "table_caption", "code_caption"}
)
_LEGACY_FOOTNOTE_TAGS = frozenset(
    {"footnote", "image_footnote", "table_footnote", "vision_footnote"}
)
_LEGACY_METADATA_TAGS = frozenset(
    {"header", "footer", "page_number", "metadata", "formula_number"}
)

DEFAULT_ALLOWED_CHANGE_RULES: tuple[dict[str, str], ...] = (
    {
        "name": "abstract_is_title",
        "old_class": "body",
        "new_class": "title",
        "semantic_role": "abstract",
        "reason": "RetainPDF broad taxonomy groups abstracts with titles",
    },
)

_RULE_MATCH_FIELDS = (
    "change_kind",
    "predicate",
    "old_value",
    "new_value",
    "old_class",
    "new_class",
    "document_id",
    "provider",
    "block_id",
    "block_path",
    "raw_label",
    "sub_type",
    "layout_role",
    "semantic_role",
    "structure_role",
)


def _normalized(value: object) -> str:
    return str(value or "").strip().lower()


def _content_kind(block: dict) -> str:
    content = block.get("content", {}) or {}
    return _normalized(
        content.get("kind")
        or block.get("block_kind")
        or block.get("type")
        or block.get("block_type")
        or "unknown"
    )


def _legacy_sub_type(block: dict) -> str:
    metadata = block.get("metadata", {}) or {}
    return _normalized(
        block.get("normalized_sub_type")
        or block.get("sub_type")
        or metadata.get("normalized_sub_type")
        or metadata.get("sub_type")
    )


def _legacy_tags(block: dict) -> frozenset[str]:
    tags = block.get("tags", []) or []
    if not isinstance(tags, (list, tuple, set, frozenset)):
        return frozenset()
    return frozenset(_normalized(tag) for tag in tags if _normalized(tag))


def legacy_block_class(block: dict | None) -> str:
    """Snapshot the pre-block_class broad decision from kind/sub_type/tags.

    This deliberately does not read canonical roles or the new block_class.
    It exists only for migration auditing and must not be used by production
    consumers.
    """

    source = block or {}
    kind = _content_kind(source)
    if kind in {"formula", "image", "table", "code"}:
        return kind
    if kind != "text":
        return "unknown"

    sub_type = _legacy_sub_type(source)
    tags = _legacy_tags(source)
    if sub_type in _LEGACY_FORMULA_SUB_TYPES:
        return "formula"
    if sub_type in _LEGACY_TITLE_SUB_TYPES or tags & _LEGACY_TITLE_TAGS:
        return "title"
    if sub_type in _LEGACY_FOOTNOTE_SUB_TYPES or tags & _LEGACY_FOOTNOTE_TAGS:
        return "footnote"
    if sub_type in _LEGACY_CAPTION_SUB_TYPES or tags & _LEGACY_CAPTION_TAGS:
        return "caption"
    if sub_type in _LEGACY_METADATA_SUB_TYPES or tags & _LEGACY_METADATA_TAGS:
        return "metadata"
    return "body"


def canonical_block_class(block: dict | None) -> str:
    """Derive the new decision only from canonical top-level contract fields."""

    source = block or {}
    return derive_block_class(
        content_kind=_content_kind(source),
        layout_role=_normalized(source.get("layout_role")),
        semantic_role=_normalized(source.get("semantic_role")),
        structure_role=_normalized(source.get("structure_role")),
    )


def legacy_predicate_vector(block: dict | None) -> dict[str, bool]:
    """Snapshot semantic decisions made from compatibility-only fields."""

    source = block or {}
    aliases = legacy_aliases(source)
    caption = bool(aliases & CAPTION_ALIASES)
    footnote = bool(aliases & FOOTNOTE_ALIASES)
    reference = bool(
        aliases & (REFERENCE_HEADING_ALIASES | REFERENCE_ENTRY_ALIASES)
    )
    algorithm = bool(aliases & ALGORITHM_ALIASES)
    document_title = bool(aliases & {"doc_title", "title"})
    body_candidate = (
        _content_kind(source) == "text"
        and legacy_block_class(source) == "body"
        and not (caption or footnote or reference or document_title)
    )
    return {
        "caption": caption,
        "footnote": footnote,
        "reference": reference,
        "algorithm": algorithm,
        "body_candidate": body_candidate,
        "document_title": document_title,
    }


def canonical_predicate_vector(block: dict | None) -> dict[str, bool]:
    """Derive semantic decisions only from canonical contract fields."""

    source = block or {}
    kind = _content_kind(source)
    layout = _normalized(source.get("layout_role"))
    semantic = _normalized(source.get("semantic_role"))
    structure = _normalized(source.get("structure_role"))
    block_class = canonical_block_class(source)
    caption = block_class == "caption" or layout == "caption" or structure in {
        "caption",
        "figure_caption",
        "image_caption",
        "table_caption",
        "code_caption",
    }
    footnote = block_class == "footnote" or layout == "footnote" or structure in {
        "footnote",
        "image_footnote",
        "table_footnote",
    }
    reference = semantic == "reference" or structure in {
        "reference_heading",
        "reference_entry",
    }
    algorithm = semantic == "algorithm" or structure in {"algorithm", "code_block"}
    document_title = layout == "title" or structure in {"document_title", "title"}
    body_candidate = (
        kind == "text"
        and block_class == "body"
        and not (caption or footnote or reference or document_title)
    )
    return {
        "caption": caption,
        "footnote": footnote,
        "reference": reference,
        "algorithm": algorithm,
        "body_candidate": body_candidate,
        "document_title": document_title,
    }


def _iter_blocks(document: dict) -> Iterable[tuple[int, str, dict]]:
    for page_offset, page in enumerate(document.get("pages", []) or []):
        page_index = int(page.get("page_index", page_offset) or page_offset)

        def visit(
            blocks: list[dict],
            parent_path: str = "",
            current_page_index: int = page_index,
        ) -> Iterable[tuple[int, str, dict]]:
            for block_offset, block in enumerate(blocks):
                block_path = (
                    f"{parent_path}.{block_offset}"
                    if parent_path
                    else f"p{current_page_index}.b{block_offset}"
                )
                yield current_page_index, block_path, block
                children = block.get("blocks", []) or []
                if isinstance(children, list):
                    yield from visit(children, block_path, current_page_index)

        blocks = page.get("blocks", []) or []
        if isinstance(blocks, list):
            yield from visit(blocks)


def _block_change_record(
    *,
    document: dict,
    source_path: str,
    page_index: int,
    block_path: str,
    block: dict,
    old_class: str,
    new_class: str,
) -> dict[str, Any]:
    source = block.get("source", {}) or {}
    provenance = block.get("provenance", {}) or {}
    return {
        "change_kind": "block_class",
        "source_path": source_path,
        "document_id": str(document.get("document_id", "") or ""),
        "provider": str((document.get("source", {}) or {}).get("provider", "") or ""),
        "page_index": page_index,
        "block_id": str(block.get("block_id", "") or ""),
        "block_path": block_path,
        "old_class": old_class,
        "new_class": new_class,
        "declared_block_class": _normalized(block.get("block_class")),
        "content_kind": _content_kind(block),
        "raw_label": _normalized(
            provenance.get("raw_label")
            or source.get("raw_type")
            or block.get("raw_block_type")
        ),
        "sub_type": _legacy_sub_type(block),
        "layout_role": _normalized(block.get("layout_role")),
        "semantic_role": _normalized(block.get("semantic_role")),
        "structure_role": _normalized(block.get("structure_role")),
    }


def _predicate_change_record(
    *,
    document: dict,
    source_path: str,
    page_index: int,
    block_path: str,
    block: dict,
    old_class: str,
    new_class: str,
    predicate: str,
    old_value: bool,
    new_value: bool,
) -> dict[str, Any]:
    record = _block_change_record(
        document=document,
        source_path=source_path,
        page_index=page_index,
        block_path=block_path,
        block=block,
        old_class=old_class,
        new_class=new_class,
    )
    record.update(
        {
            "change_kind": "predicate",
            "predicate": predicate,
            "old_value": old_value,
            "new_value": new_value,
        }
    )
    return record


def _match_text(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value or "")


def _matching_rule(
    change: dict, rules: Iterable[dict[str, str]]
) -> dict[str, str] | None:
    for rule in rules:
        if all(
            not str(rule.get(field, "") or "").strip()
            or fnmatchcase(_match_text(change.get(field, "")), str(rule[field]))
            for field in _RULE_MATCH_FIELDS
        ):
            return rule
    return None


def _matching_predicate_rule(
    change: dict, rules: Iterable[dict[str, str]]
) -> dict[str, str] | None:
    explicitly_predicate_rules = (
        rule
        for rule in rules
        if str(rule.get("predicate", "") or "").strip()
        or str(rule.get("change_kind", "") or "").strip() == "predicate"
    )
    return _matching_rule(change, explicitly_predicate_rules)


def validate_allowlist_rules(
    rules: Iterable[dict[str, str]],
) -> tuple[dict[str, str], ...]:
    validated: list[dict[str, str]] = []
    for index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            raise TypeError(f"allowlist rule[{index}] must be an object")
        reason = str(rule.get("reason", "") or "").strip()
        if not reason:
            raise ValueError(f"allowlist rule[{index}] must include a reason")
        match_values = [
            str(rule.get(field, "") or "").strip() for field in _RULE_MATCH_FIELDS
        ]
        if not any(value and value not in {"*", "**"} for value in match_values):
            raise ValueError(
                f"allowlist rule[{index}] must constrain at least one match field"
            )
        validated.append({str(key): str(value) for key, value in rule.items()})
    return tuple(validated)


def load_allowlist_payload(payload: dict | None) -> tuple[dict[str, str], ...]:
    source = payload or {}
    if source.get("schema") != ALLOWLIST_SCHEMA:
        raise ValueError(f"allowlist schema must be {ALLOWLIST_SCHEMA}")
    rules = source.get("rules", [])
    if not isinstance(rules, list):
        raise TypeError("allowlist rules must be an array")
    return validate_allowlist_rules(rules)


def build_block_class_decision_diff(
    documents: Iterable[tuple[str, dict]],
    *,
    extra_allow_rules: Iterable[dict[str, str]] = (),
) -> dict[str, Any]:
    rules = validate_allowlist_rules(
        (*DEFAULT_ALLOWED_CHANGE_RULES, *tuple(extra_allow_rules))
    )
    old_counts: Counter[str] = Counter()
    new_counts: Counter[str] = Counter()
    transition_counts: Counter[str] = Counter()
    legacy_predicate_counts: Counter[str] = Counter()
    canonical_predicate_counts: Counter[str] = Counter()
    predicate_transition_counts: Counter[str] = Counter()
    changes: list[dict[str, Any]] = []
    predicate_changes: list[dict[str, Any]] = []
    contract_conflicts: list[dict[str, Any]] = []
    document_summaries: list[dict[str, Any]] = []
    block_count = 0

    for source_path, raw_document in documents:
        document = ensure_normalized_document(raw_document)
        document_blocks = 0
        document_changes = 0
        document_unexpected = 0
        document_predicate_changes = 0
        document_unexpected_predicates = 0
        document_conflicts = 0
        for page_index, block_path, block in _iter_blocks(document):
            old_class = legacy_block_class(block)
            new_class = canonical_block_class(block)
            old_counts[old_class] += 1
            new_counts[new_class] += 1
            old_predicates = legacy_predicate_vector(block)
            new_predicates = canonical_predicate_vector(block)
            for predicate in PREDICATE_NAMES:
                old_value = old_predicates[predicate]
                new_value = new_predicates[predicate]
                if old_value:
                    legacy_predicate_counts[predicate] += 1
                if new_value:
                    canonical_predicate_counts[predicate] += 1
                if old_value == new_value:
                    continue
                predicate_change = _predicate_change_record(
                    document=document,
                    source_path=source_path,
                    page_index=page_index,
                    block_path=block_path,
                    block=block,
                    old_class=old_class,
                    new_class=new_class,
                    predicate=predicate,
                    old_value=old_value,
                    new_value=new_value,
                )
                predicate_rule = _matching_predicate_rule(predicate_change, rules)
                predicate_change["allowed"] = predicate_rule is not None
                predicate_change["allow_rule"] = str(
                    (predicate_rule or {}).get("name", "") or ""
                )
                predicate_change["allow_reason"] = str(
                    (predicate_rule or {}).get("reason", "") or ""
                )
                predicate_changes.append(predicate_change)
                transition = (
                    f"{predicate}:"
                    f"{_match_text(old_value)}->{_match_text(new_value)}"
                )
                predicate_transition_counts[transition] += 1
                document_predicate_changes += 1
                if predicate_rule is None:
                    document_unexpected_predicates += 1
            block_count += 1
            document_blocks += 1
            declared_class = _normalized(block.get("block_class"))
            if declared_class and declared_class != new_class:
                conflict = _block_change_record(
                    document=document,
                    source_path=source_path,
                    page_index=page_index,
                    block_path=block_path,
                    block=block,
                    old_class=old_class,
                    new_class=new_class,
                )
                conflict["declared_block_class"] = declared_class
                conflict["reason"] = (
                    "declared block_class conflicts with canonical fields"
                )
                contract_conflicts.append(conflict)
                document_conflicts += 1
            if old_class == new_class:
                continue

            change = _block_change_record(
                document=document,
                source_path=source_path,
                page_index=page_index,
                block_path=block_path,
                block=block,
                old_class=old_class,
                new_class=new_class,
            )
            rule = _matching_rule(change, rules)
            change["allowed"] = rule is not None
            change["allow_rule"] = str((rule or {}).get("name", "") or "")
            change["allow_reason"] = str((rule or {}).get("reason", "") or "")
            changes.append(change)
            transition_counts[f"{old_class}->{new_class}"] += 1
            document_changes += 1
            if rule is None:
                document_unexpected += 1

        document_summaries.append(
            {
                "source_path": source_path,
                "document_id": str(document.get("document_id", "") or ""),
                "block_count": document_blocks,
                "change_count": document_changes,
                "unexpected_change_count": document_unexpected,
                "predicate_change_count": document_predicate_changes,
                "unexpected_predicate_change_count": document_unexpected_predicates,
                "contract_conflict_count": document_conflicts,
            }
        )

    changes.sort(
        key=lambda item: (
            item["source_path"],
            item["page_index"],
            item["block_path"],
        )
    )
    allowed_count = sum(1 for change in changes if change["allowed"])
    unexpected_count = len(changes) - allowed_count
    predicate_changes.sort(
        key=lambda item: (
            item["source_path"],
            item["page_index"],
            item["block_path"],
            item["predicate"],
        )
    )
    allowed_predicate_count = sum(
        1 for change in predicate_changes if change["allowed"]
    )
    unexpected_predicate_changes = [
        change for change in predicate_changes if not change["allowed"]
    ]
    contract_conflicts.sort(
        key=lambda item: (
            item["source_path"],
            item["page_index"],
            item["block_path"],
        )
    )
    return {
        "schema": REPORT_SCHEMA,
        "status": (
            "pass"
            if unexpected_count == 0
            and not unexpected_predicate_changes
            and not contract_conflicts
            else "fail"
        ),
        "document_count": len(document_summaries),
        "block_count": block_count,
        "unchanged_count": block_count - len(changes),
        "change_count": len(changes),
        "allowed_change_count": allowed_count,
        "unexpected_change_count": unexpected_count,
        "predicate_change_count": len(predicate_changes),
        "allowed_predicate_change_count": allowed_predicate_count,
        "unexpected_predicate_change_count": len(unexpected_predicate_changes),
        "contract_conflict_count": len(contract_conflicts),
        "old_class_counts": dict(sorted(old_counts.items())),
        "new_class_counts": dict(sorted(new_counts.items())),
        "transition_counts": dict(sorted(transition_counts.items())),
        "legacy_predicate_counts": {
            name: legacy_predicate_counts[name] for name in PREDICATE_NAMES
        },
        "canonical_predicate_counts": {
            name: canonical_predicate_counts[name] for name in PREDICATE_NAMES
        },
        "predicate_transition_counts": dict(
            sorted(predicate_transition_counts.items())
        ),
        "documents": document_summaries,
        "changes": changes,
        "predicate_changes": predicate_changes,
        "unexpected_predicate_changes": unexpected_predicate_changes,
        "contract_conflicts": contract_conflicts,
    }


__all__ = [
    "ALLOWLIST_SCHEMA",
    "DEFAULT_ALLOWED_CHANGE_RULES",
    "PREDICATE_NAMES",
    "REPORT_SCHEMA",
    "build_block_class_decision_diff",
    "canonical_block_class",
    "canonical_predicate_vector",
    "legacy_block_class",
    "legacy_predicate_vector",
    "load_allowlist_payload",
    "validate_allowlist_rules",
]
