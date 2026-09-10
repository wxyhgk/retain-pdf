from __future__ import annotations

from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue
from retainpdf_pipeline.translate.services.quality import TranslationQualityReport
from retainpdf_pipeline.translate.services.quality import review_translation_batch
from retainpdf_pipeline.translate.services.quality import review_translation_item
from retainpdf_pipeline.translate.services.terms import GlossaryEntry
from retainpdf_pipeline.translate.services.terms import normalize_glossary_entries


TranslationReviewIssue = TranslationQualityIssue
TranslationReviewResult = TranslationQualityReport


class ConsistencyReviewerAgent:
    name = "consistency_reviewer"

    def __init__(self, glossary_entries: list[GlossaryEntry | dict] | None = None):
        self._glossary_entries = normalize_glossary_entries(glossary_entries)

    def review_batch(
        self,
        batch: list[dict],
        result: dict[str, dict[str, str]],
    ) -> TranslationReviewResult:
        return review_translation_batch(batch, result, glossary_entries=self._glossary_entries)

    def review_item(self, item: dict, translated_result: dict[str, str]) -> TranslationReviewResult:
        return review_translation_item(item, translated_result, glossary_entries=self._glossary_entries)


__all__ = [
    "ConsistencyReviewerAgent",
    "TranslationReviewIssue",
    "TranslationReviewResult",
]
