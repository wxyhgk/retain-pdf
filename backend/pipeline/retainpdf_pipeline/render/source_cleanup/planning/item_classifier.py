from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from retainpdf_pipeline.render.semantics.item_view import (
    block_kind,
    role_values,
)

ItemPredicate = Callable[[dict], bool]


VECTOR_OVERLAP_ROLE_ALLOWLIST = frozenset(
    {
        "heading",
        "title",
        "toc",
        "table_of_contents",
        "page_number",
    }
)
TEXT_STRIP_ROLE_ALLOWLIST = frozenset(
    {
        "caption",
        "figure_caption",
        "image_caption",
        "table_caption",
        "footnote",
        "table_footnote",
        "image_footnote",
        "vision_footnote",
        "metadata",
    }
)
ITEM_COVER_FALLBACK_ROLE_ALLOWLIST = TEXT_STRIP_ROLE_ALLOWLIST


@dataclass(frozen=True)
class CleanupItemClass:
    name: str
    allows_vector_overlap: bool
    matches: ItemPredicate


def page_all_strip_items_allow_vector_overlap(items: list[dict]) -> bool:
    strip_text_items = tuple(item for item in items if item_is_text(item))
    return bool(strip_text_items) and all(item_allows_vector_overlap(item) for item in strip_text_items)


def item_allows_vector_overlap(item: dict) -> bool:
    item_class = first_cleanup_item_class(item)
    return item_class.allows_vector_overlap if item_class is not None else False


def item_allows_forced_text_strip(item: dict) -> bool:
    return item_is_text(item) and item_matches_role_allowlist(item, TEXT_STRIP_ROLE_ALLOWLIST)


def item_allows_item_cover_fallback(item: dict) -> bool:
    return item_is_text(item) and item_matches_role_allowlist(item, ITEM_COVER_FALLBACK_ROLE_ALLOWLIST)


def first_cleanup_item_class(item: dict) -> CleanupItemClass | None:
    return next((item_class for item_class in CLEANUP_ITEM_CLASSES if item_class.matches(item)), None)


def item_is_text(item: dict) -> bool:
    return item_block_kind(item) == "text"


def item_block_kind(item: dict) -> str:
    return block_kind(item)


def item_role_values(item: dict) -> frozenset[str]:
    return role_values(item)


def item_matches_role_allowlist(item: dict, allowlist: frozenset[str]) -> bool:
    return bool(item_role_values(item) & allowlist)


CLEANUP_ITEM_CLASSES: tuple[CleanupItemClass, ...] = (
    CleanupItemClass(
        name="force_strip_text",
        allows_vector_overlap=True,
        matches=item_allows_forced_text_strip,
    ),
    CleanupItemClass(
        name="safe_decorated_text",
        allows_vector_overlap=True,
        matches=lambda item: item_is_text(item) and item_matches_role_allowlist(item, VECTOR_OVERLAP_ROLE_ALLOWLIST),
    ),
    CleanupItemClass(
        name="ordinary_text",
        allows_vector_overlap=False,
        matches=item_is_text,
    ),
)
