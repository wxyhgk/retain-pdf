from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.render.source_cleanup.policy.adapter import has_formula_region


FormulaPredicate = Callable[[dict], bool]

LATIN_WORD_RE = re.compile(r"[A-Za-z]{3,}")
TEX_COMMAND_RE = re.compile(r"\\[A-Za-z]+")


@dataclass(frozen=True)
class FormulaCleanupClass:
    name: str
    protects_source: bool
    strips_source_text: bool
    matches: FormulaPredicate


FORMULA_CLEANUP_CLASSES: tuple[FormulaCleanupClass, ...] = (
    FormulaCleanupClass(
        name="textual_formula",
        protects_source=False,
        strips_source_text=True,
        matches=lambda item: has_formula_region(item) and formula_text_has_latin_words(item),
    ),
    FormulaCleanupClass(
        name="math_formula",
        protects_source=True,
        strips_source_text=False,
        matches=has_formula_region,
    ),
)


def first_formula_cleanup_class(item: dict) -> FormulaCleanupClass | None:
    return next((formula_class for formula_class in FORMULA_CLEANUP_CLASSES if formula_class.matches(item)), None)


def formula_text_has_latin_words(item: dict) -> bool:
    text = formula_source_text(item)
    if not text:
        return False
    normalized = TEX_COMMAND_RE.sub(" ", text)
    return bool(LATIN_WORD_RE.search(normalized))


def formula_source_text(item: dict) -> str:
    return str(
        item.get("source_text")
        or item.get("protected_source_text")
        or item.get("translation_unit_protected_source_text")
        or ""
    )
