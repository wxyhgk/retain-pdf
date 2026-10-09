"""全书术语库 term-base.v1.json：多数票、冲突记录、用户术语优先。

字段约定（QA 报告等下游直接读这些键名，改名要同步）：

    {
      "schema": "term_base_v1",
      "schema_version": 1,
      "inputs_fingerprint": "...",          # 决定是否可以原样复用（冻结）
      "complete": true,                     # 有批失败时为 false，下次运行会补跑
      "terms": [
        {
          "source": "harmonic oscillator",  # 源词（原文首现形式）
          "target": "谐振子",                # 译法
          "frequency": 12,                  # 全文出现次数（按词边界、忽略大小写）
          "first_occurrence": {"page_index": 2, "page_number": 3, "item_id": "..."},
          "conflict_candidates": [{"target": "简谐振子", "votes": 1}],
          "origin": "extracted",            # user_glossary | extracted
          "votes": 5,                       # 采纳译法得到的票数（user_glossary 为 0）
          "kind": "domain_term",            # proper_noun | domain_term | user_glossary
          "level": "preferred"              # 注入时的术语级别；用户术语保留原级别
        }
      ],
      "conflicts": [...]                    # conflict_candidates 非空的条目的源词清单
    }

多数票按「批」计票：同一批里同一个词只算一票。平票取首现更早的译法。
用户术语表里有的词一律用用户的译法，抽取出来的不同译法降为 conflict_candidates。
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any

from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.core.terms.glossary import context_matches
from retainpdf_pipeline.translate.core.terms.glossary import term_pattern
from retainpdf_pipeline.translate.services.preparation.segments import PrescanSegment
from retainpdf_pipeline.translate.services.preparation.term_prescan import PrescanBatchResult

TERM_BASE_FILE_NAME = "term-base.v1.json"
TERM_BASE_SCHEMA = "term_base_v1"
TERM_BASE_SCHEMA_VERSION = 1
ORIGIN_USER_GLOSSARY = "user_glossary"
ORIGIN_EXTRACTED = "extracted"

_ACRONYM_RE = re.compile(r"^[A-Z0-9][A-Z0-9\-]+s?$")


@dataclass(frozen=True)
class _Vote:
    target: str
    batch_order: int
    source_surface: str
    kind: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _surface_pattern(source: str) -> re.Pattern[str]:
    escaped = re.escape(source).replace(r"\ ", r"\s+")
    return re.compile(rf"(?<![A-Za-z0-9_]){escaped}(?![A-Za-z0-9_])", re.IGNORECASE)


def _occurrences(pattern: re.Pattern[str], segments: list[PrescanSegment]) -> tuple[int, PrescanSegment | None]:
    count = 0
    first: PrescanSegment | None = None
    for segment in segments:
        hits = len(pattern.findall(segment.text))
        if hits and first is None:
            first = segment
        count += hits
    return count, first


def _user_entry_occurrences(entry: GlossaryEntry, segments: list[PrescanSegment]) -> tuple[int, PrescanSegment | None]:
    pattern = term_pattern(entry)
    count = 0
    first: PrescanSegment | None = None
    for segment in segments:
        hits = sum(
            1
            for match in pattern.finditer(segment.text)
            if context_matches(segment.text, entry, start=match.start(), end=match.end())
        )
        if hits and first is None:
            first = segment
        count += hits
    return count, first


def _first_occurrence(segment: PrescanSegment | None) -> dict[str, Any] | None:
    if segment is None:
        return None
    return {
        "page_index": segment.page_index,
        "page_number": segment.page_index + 1,
        "item_id": segment.segment_id,
    }


def _user_entry_covering(source: str, user_entries: list[GlossaryEntry]) -> GlossaryEntry | None:
    """用户术语里能整词覆盖这个抽取词的那一条（用户优先）。"""
    folded = source.casefold()
    for entry in user_entries:
        if entry.match_mode != "regex" and entry.source.casefold() == folded:
            return entry
    for entry in user_entries:
        match = term_pattern(entry).search(source)
        if match is not None and match.start() == 0 and match.end() == len(source):
            return entry
    return None


def _normalized_target(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def build_term_base_terms(
    *,
    batch_results: list[PrescanBatchResult],
    segments: list[PrescanSegment],
    user_entries: list[GlossaryEntry] | None,
) -> list[dict[str, Any]]:
    users = normalize_glossary_entries(user_entries)
    votes_by_key: dict[str, list[_Vote]] = {}
    for order, result in enumerate(batch_results):
        seen_in_batch: set[str] = set()
        for term in result.terms:
            key = term.source.casefold()
            if not key or key in seen_in_batch:
                continue
            seen_in_batch.add(key)
            votes_by_key.setdefault(key, []).append(
                _Vote(
                    target=_normalized_target(term.target),
                    batch_order=order,
                    source_surface=term.source,
                    kind=term.kind,
                )
            )

    terms: list[dict[str, Any]] = []
    user_records: dict[int, dict[str, Any]] = {}
    for key, votes in votes_by_key.items():
        tally = Counter(vote.target for vote in votes if vote.target)
        if not tally:
            continue
        first_order = {}
        for vote in votes:
            first_order.setdefault(vote.target, vote.batch_order)
        ranked = sorted(tally.items(), key=lambda pair: (-pair[1], first_order[pair[0]], pair[0]))
        surface = Counter(vote.source_surface for vote in votes).most_common(1)[0][0]
        kind = Counter(vote.kind for vote in votes).most_common(1)[0][0]
        covering = _user_entry_covering(surface, users)
        if covering is not None:
            # 用户术语优先：抽取出来的不同译法全部降为冲突候选。
            record = user_records.get(id(covering))
            if record is None:
                record = _user_record(covering, segments)
                if record is None:
                    continue
                user_records[id(covering)] = record
            user_target = record["target"]
            known = {item["target"] for item in record["conflict_candidates"]}
            for target, count in ranked:
                if target != user_target and target not in known:
                    record["conflict_candidates"].append({"target": target, "votes": count})
                    known.add(target)
            continue
        frequency, first = _occurrences(_surface_pattern(surface), segments)
        winner, winner_votes = ranked[0]
        terms.append(
            {
                "source": surface,
                "target": winner,
                "frequency": frequency,
                "first_occurrence": _first_occurrence(first),
                "conflict_candidates": [
                    {"target": target, "votes": count} for target, count in ranked[1:]
                ],
                "origin": ORIGIN_EXTRACTED,
                "votes": winner_votes,
                "kind": kind,
                "level": "preferred",
            }
        )

    for entry in users:
        if id(entry) in user_records:
            continue
        record = _user_record(entry, segments)
        if record is not None:
            user_records[id(entry)] = record
    terms.extend(user_records.values())
    terms.sort(key=lambda item: (-int(item["frequency"]), str(item["source"]).casefold()))
    return terms


def _user_record(entry: GlossaryEntry, segments: list[PrescanSegment]) -> dict[str, Any] | None:
    frequency, first = _user_entry_occurrences(entry, segments)
    if frequency <= 0:
        return None
    return {
        "source": entry.source,
        "target": entry.source if entry.level == "preserve" else entry.target,
        "frequency": frequency,
        "first_occurrence": _first_occurrence(first),
        "conflict_candidates": [],
        "origin": ORIGIN_USER_GLOSSARY,
        "votes": 0,
        "kind": ORIGIN_USER_GLOSSARY,
        "level": entry.level,
    }


def build_term_base_payload(
    *,
    terms: list[dict[str, Any]],
    inputs_fingerprint: str,
    complete: bool,
    preparation_mode: str,
    extraction: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    conflicts = [
        {"source": item["source"], "target": item["target"], "conflict_candidates": item["conflict_candidates"]}
        for item in terms
        if item.get("conflict_candidates")
    ]
    return {
        "schema": TERM_BASE_SCHEMA,
        "schema_version": TERM_BASE_SCHEMA_VERSION,
        "generated_at": now_iso(),
        "preparation_mode": preparation_mode,
        "inputs_fingerprint": inputs_fingerprint,
        "complete": bool(complete),
        "source": source,
        "extraction": extraction,
        "summary": {
            "term_count": len(terms),
            "user_glossary_count": sum(1 for item in terms if item.get("origin") == ORIGIN_USER_GLOSSARY),
            "extracted_count": sum(1 for item in terms if item.get("origin") == ORIGIN_EXTRACTED),
            "conflict_count": len(conflicts),
        },
        "terms": terms,
        "conflicts": conflicts,
    }


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, text=True)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
    except Exception:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
        raise


def load_json_object(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


def load_term_base(path: Path) -> dict[str, Any] | None:
    payload = load_json_object(path)
    if payload is None:
        return None
    if payload.get("schema") != TERM_BASE_SCHEMA or payload.get("schema_version") != TERM_BASE_SCHEMA_VERSION:
        return None
    if not isinstance(payload.get("terms"), list):
        return None
    return payload


def file_sha256(path: Path) -> str:
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()
    except OSError:
        return ""


def term_base_glossary_entries(payload: dict[str, Any] | None) -> list[GlossaryEntry]:
    """术语库里需要额外注入的条目：只取抽取出来、未被用户术语覆盖的那部分。

    用户条目本来就在 glossary_entries 里按原级别注入，这里不重复。缩写/全大写
    用精确匹配，其余忽略大小写（句首大写的同一个词也要命中）。
    """
    if not payload:
        return []
    entries: list[dict[str, Any]] = []
    for item in payload.get("terms", []):
        if not isinstance(item, dict) or item.get("origin") != ORIGIN_EXTRACTED:
            continue
        source = str(item.get("source", "") or "").strip()
        target = str(item.get("target", "") or "").strip()
        if not source or not target:
            continue
        # 术语专员审定过的：人名 / 机构不强制、通用词剔除；文献与期刊名保留原文。
        treatment = str(item.get("treatment", "") or "lock")
        if treatment in ("free", "drop"):
            continue
        keep_original = treatment == "keep_original"
        entries.append(
            {
                "source": source,
                "target": source if keep_original else target,
                "level": "preserve" if keep_original else "preferred",
                "match_mode": "exact" if _ACRONYM_RE.match(source) else "case_insensitive",
            }
        )
    return normalize_glossary_entries(entries)


__all__ = [
    "ORIGIN_EXTRACTED",
    "ORIGIN_USER_GLOSSARY",
    "TERM_BASE_FILE_NAME",
    "TERM_BASE_SCHEMA",
    "TERM_BASE_SCHEMA_VERSION",
    "build_term_base_payload",
    "build_term_base_terms",
    "file_sha256",
    "load_json_object",
    "load_term_base",
    "now_iso",
    "term_base_glossary_entries",
    "write_json_atomic",
]
