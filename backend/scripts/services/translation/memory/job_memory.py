from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.translation.memory.candidates import extract_term_candidates
from services.translation.memory.constants import MAX_PRESERVE_HINT_RECORDS
from services.translation.memory.constants import MAX_RETRIEVED_PRESERVE_HINTS
from services.translation.memory.constants import MAX_RETRIEVED_SUMMARY_TERMS
from services.translation.memory.constants import MAX_TERM_RECORDS
from services.translation.memory.constants import MEMORY_VERSION
from services.translation.memory.filters import is_preserve_candidate
from services.translation.memory.filters import looks_like_useful_term_key
from services.translation.memory.filters import looks_like_useful_term_value
from services.translation.memory.filters import term_record_allowed_in_prompt
from services.translation.memory.summary import build_prompt_summary
from services.translation.memory.summary import build_prompt_summary_for_source
from services.translation.memory.text import clean_term_key
from services.translation.memory.text import clean_term_value
from services.translation.memory.text import normalize_space
from services.translation.memory.text import source_text_for_batch


@dataclass
class JobMemory:
    path: Path
    terms: dict[str, dict[str, Any]]
    preserve_hints: dict[str, dict[str, Any]]

    @classmethod
    def empty(cls, path: Path) -> "JobMemory":
        return cls(path=path, terms={}, preserve_hints={})

    @classmethod
    def from_dict(cls, path: Path, payload: dict[str, Any]) -> "JobMemory":
        return cls(
            path=path,
            terms={str(key): dict(value) for key, value in dict(payload.get("terms") or {}).items()},
            preserve_hints={
                str(key): dict(value)
                for key, value in dict(payload.get("preserve_hints") or {}).items()
            },
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": MEMORY_VERSION,
            "terms": self.terms,
            "preserve_hints": self.preserve_hints,
        }

    def add_term(self, *, key: str, value: str, source: str) -> bool:
        normalized_key = clean_term_key(key)
        normalized_value = clean_term_value(value)
        if not looks_like_useful_term_key(normalized_key) or not normalized_value:
            return False
        record = self.terms.setdefault(
            normalized_key,
            {
                "key": normalized_key,
                "value": normalized_value,
                "hits": 0,
                "sources": [],
            },
        )
        existing_value = clean_term_value(str(record.get("value") or ""))
        if looks_like_useful_term_value(normalized_value) or not looks_like_useful_term_value(existing_value):
            record["value"] = normalized_value
        record["hits"] = int(record.get("hits") or 0) + 1
        sources = list(record.get("sources") or [])
        if source and source not in sources:
            sources.append(source)
        record["sources"] = sources[-8:]
        record["prompt_eligible"] = term_record_allowed_in_prompt(record)
        return True

    def add_preserve_hint(self, *, key: str, source: str) -> bool:
        normalized_key = normalize_space(key)[:120]
        if not normalized_key:
            return False
        record = self.preserve_hints.setdefault(
            normalized_key,
            {
                "key": normalized_key,
                "hits": 0,
                "sources": [],
            },
        )
        record["hits"] = int(record.get("hits") or 0) + 1
        sources = list(record.get("sources") or [])
        if source and source not in sources:
            sources.append(source)
        record["sources"] = sources[-8:]
        return True

    def trim(self) -> None:
        self.terms = dict(
            sorted(
                self.terms.items(),
                key=lambda item: (int(item[1].get("hits") or 0), item[0]),
                reverse=True,
            )[:MAX_TERM_RECORDS]
        )
        self.preserve_hints = dict(
            sorted(
                self.preserve_hints.items(),
                key=lambda item: (int(item[1].get("hits") or 0), item[0]),
                reverse=True,
            )[:MAX_PRESERVE_HINT_RECORDS]
        )

    def prompt_summary(self) -> str:
        return build_prompt_summary(self.terms, self.preserve_hints)

    def prompt_summary_for_source(
        self,
        source_text: str,
        *,
        max_terms: int = MAX_RETRIEVED_SUMMARY_TERMS,
        max_preserve_hints: int = MAX_RETRIEVED_PRESERVE_HINTS,
    ) -> str:
        return build_prompt_summary_for_source(
            self.terms,
            self.preserve_hints,
            source_text,
            max_terms=max_terms,
            max_preserve_hints=max_preserve_hints,
        )


class JobMemoryStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def load(self) -> JobMemory:
        if not self.path.exists():
            return JobMemory.empty(self.path)
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return JobMemory.empty(self.path)
        if not isinstance(payload, dict):
            return JobMemory.empty(self.path)
        return JobMemory.from_dict(self.path, payload)

    def save(self, memory: JobMemory) -> None:
        memory.trim()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.path.with_suffix(f"{self.path.suffix}.tmp")
        tmp_path.write_text(
            json.dumps(memory.to_dict(), ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp_path.replace(self.path)

    def summary(self) -> str:
        with self._lock:
            return self.load().prompt_summary()

    def summary_for_source(self, source_text: str) -> str:
        with self._lock:
            return self.load().prompt_summary_for_source(source_text)

    def summary_for_batch(self, batch: list[dict]) -> str:
        return self.summary_for_source(source_text_for_batch(batch))

    def update_from_batch(self, batch: list[dict], translated: dict[str, dict[str, Any]]) -> int:
        with self._lock:
            memory = self.load()
            changed = update_job_memory_from_batch(memory, batch=batch, translated=translated)
            if changed:
                self.save(memory)
            return changed


def update_job_memory_from_batch(
    memory: JobMemory,
    *,
    batch: list[dict],
    translated: dict[str, dict[str, Any]],
) -> int:
    changed = 0
    for item in batch:
        item_id = str(item.get("item_id") or "")
        result = translated.get(item_id) or {}
        translated_text = normalize_space(
            result.get("protected_translated_text")
            or result.get("translated_text")
            or item.get("protected_translated_text")
            or item.get("translated_text")
            or ""
        )
        source_text = normalize_space(
            item.get("translation_unit_protected_source_text")
            or item.get("protected_source_text")
            or item.get("source_text")
            or ""
        )
        if not source_text or not translated_text:
            continue
        for key, value in extract_term_candidates(source_text, translated_text):
            if memory.add_term(key=key, value=value, source=item_id):
                changed += 1
        if is_preserve_candidate(source_text):
            hint = source_text if len(source_text) <= 80 else f"{source_text[:77]}..."
            if memory.add_preserve_hint(key=hint, source=item_id):
                changed += 1
    return changed
