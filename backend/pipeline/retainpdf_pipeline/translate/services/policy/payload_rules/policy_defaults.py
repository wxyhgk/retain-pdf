from __future__ import annotations

from retainpdf_pipeline.translate.core.item_reader import item_block_class
from retainpdf_pipeline.translate.core.item_reader import item_is_algorithm_like
from retainpdf_pipeline.translate.core.item_reader import item_content_kind
from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_compatible
from retainpdf_pipeline.translate.core.item_reader import item_policy_translate
from retainpdf_pipeline.translate.core.item_reader import item_raw_block_type
from retainpdf_pipeline.translate.core.item_reader import item_structure_role

_FOUNDATIONAL_SKIP_BY_BLOCK_TYPE = {
    "image_body": ("skip_image_body", "skip_image_body"),
    "table_body": ("skip_table_body", "skip_table_body"),
    "code_body": ("code", "code"),
}
_FOUNDATIONAL_SKIP_BY_BLOCK_CLASS = {
    "image": ("skip_image_body", "skip_image_body"),
    "table": ("skip_table_body", "skip_table_body"),
    "code": ("code", "code"),
    "formula": ("skip_formula", "skip_formula"),
}
_DEFAULT_TRANSLATABLE_TEXT_STRUCTURE_ROLES = {
    "",
    "body",
    "abstract",
    "heading",
    "title",
    "footnote",
    "image_footnote",
    "table_footnote",
}


def is_ref_text_like(item: dict) -> bool:
    return item_is_reference_compatible(item)


def is_default_translatable_text_item(item: dict) -> bool:
    explicit_policy = item_policy_translate(item)
    if explicit_policy is not None:
        return explicit_policy
    if item_content_kind(item) != "text":
        return False
    role = item_structure_role(item)
    if item_is_bodylike(item):
        return True
    return role in _DEFAULT_TRANSLATABLE_TEXT_STRUCTURE_ROLES


def foundational_skip_defaults(item: dict) -> tuple[str, str] | None:
    if item_is_algorithm_like(item):
        return "skip_algorithm", "skip_algorithm"
    block_type = item_raw_block_type(item)
    normalized_block_type = block_type.strip().lower()
    block_class = item_block_class(item)
    if is_ref_text_like(item):
        return None
    if is_default_translatable_text_item(item):
        return None
    if block_class in _FOUNDATIONAL_SKIP_BY_BLOCK_CLASS:
        # The raw label is retained only as a compatibility projection for
        # stable historical skip_reason/classification_label values.
        if normalized_block_type in _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE:
            return _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE[normalized_block_type]
        if normalized_block_type and normalized_block_type not in {"text", block_class}:
            return f"skip_{normalized_block_type}", f"skip_{normalized_block_type}"
        return _FOUNDATIONAL_SKIP_BY_BLOCK_CLASS[block_class]
    if normalized_block_type in _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE:
        return _FOUNDATIONAL_SKIP_BY_BLOCK_TYPE[normalized_block_type]
    if normalized_block_type:
        return f"skip_{normalized_block_type}", f"skip_{normalized_block_type}"
    return "skip_non_body_text", "skip_non_body_text"


__all__ = [
    "foundational_skip_defaults",
    "is_default_translatable_text_item",
    "is_ref_text_like",
]
