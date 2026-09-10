from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.translate.services.terms import GlossaryEntry
from retainpdf_pipeline.translate.services.terms import build_terms_guidance
from retainpdf_pipeline.translate.services.terms import matched_glossary_entries
from retainpdf_pipeline.translate.services.terms import normalize_glossary_entries


@dataclass(frozen=True)
class TerminologyMatchResult:
    entries: list[GlossaryEntry]
    guidance: str
    source_text_count: int
    matched_entry_count: int

    def as_dict(self) -> dict[str, object]:
        return {
            "source_text_count": self.source_text_count,
            "matched_entry_count": self.matched_entry_count,
            "entries": [
                {
                    "source": entry.source,
                    "target": entry.target,
                    "level": entry.level,
                    "match_mode": entry.match_mode,
                    "context": entry.context,
                    "note": entry.note,
                }
                for entry in self.entries
            ],
            "guidance": self.guidance,
        }


class TerminologyAgent:
    name = "terminology"

    def __init__(self, glossary_entries: list[GlossaryEntry | dict] | None = None):
        self._glossary_entries = normalize_glossary_entries(glossary_entries)

    @property
    def glossary_entries(self) -> list[GlossaryEntry]:
        return list(self._glossary_entries)

    def match_source_texts(self, texts: list[str] | tuple[str, ...]) -> TerminologyMatchResult:
        source_text = "\n".join(text for text in texts if text)
        if not source_text or not self._glossary_entries:
            matched: list[GlossaryEntry] = []
        else:
            matched = matched_glossary_entries(self._glossary_entries, source_text)
        return TerminologyMatchResult(
            entries=matched,
            guidance=build_terms_guidance(glossary_entries=matched),
            source_text_count=len([text for text in texts if text]),
            matched_entry_count=len(matched),
        )


__all__ = [
    "TerminologyAgent",
    "TerminologyMatchResult",
]
