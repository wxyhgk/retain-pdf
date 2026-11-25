"""从 document.v1 取目录条目和正文标题，跑目录 agent，结果存进翻译输出目录。

- 条目：归一化时按文字层拆出来的块（``structure_role = toc_entry``，流水线 ``ocr/document_schema/toc_pages.py``），
  而且这一块要翻（policy.translate）。标题去掉章号（章号在 ``metadata.toc_entry_number``）。
- 标题：``structure_role`` 是 ``heading`` / ``document_title``（GLM-OCR 的章标题）且要翻的块。``skip_titles`` 为真（任务设了不翻标题）时不给标题定译。
- 带公式的不碰（定译是纯文字，会把公式弄丢），交给普通翻译。
- 缓存 ``toc-agent.v1.json``：输入（条目、标题、术语表、模型、提示词版本）一样就直接用上次的结果，续跑不再发请求，
  定译不变（它进翻译 checkpoint 的指纹）。
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Callable, Iterable

from retainpdf_toc_agent import PROMPT_VERSION
from retainpdf_toc_agent import GlossaryTerm
from retainpdf_toc_agent import Heading
from retainpdf_toc_agent import TocEntry
from retainpdf_toc_agent import translate_toc

RESULT_FILE_NAME = "toc-agent.v1.json"
SCHEMA = "toc_agent_result_v1"
TOC_ENTRY_ROLE = "toc_entry"
# 正文标题：GLM-OCR 常把章标题标成 document_title（书名也是，书名对不上目录条目，不会误配）
HEADING_ROLES = frozenset({"heading", "document_title"})
_FORMULA_MARKERS = ("$", "\\(", "\\[")


def _block_text(block: dict) -> str:
    content = block.get("content") if isinstance(block.get("content"), dict) else {}
    return " ".join(str(content.get("text") or block.get("text") or "").split())


def _translatable(block: dict) -> bool:
    policy = block.get("policy") if isinstance(block.get("policy"), dict) else {}
    text = _block_text(block)
    return bool(policy.get("translate", True)) and bool(text) and not any(marker in text for marker in _FORMULA_MARKERS)


def collect(document: dict, *, skip_titles: bool = False) -> tuple[list[TocEntry], list[Heading]]:
    entries: list[TocEntry] = []
    headings: list[Heading] = []
    for page in document.get("pages") or []:
        for block in page.get("blocks") or []:
            if not isinstance(block, dict) or not _translatable(block):
                continue
            role = str(block.get("structure_role") or "")
            block_id = str(block.get("block_id") or "")
            text = _block_text(block)
            if role == TOC_ENTRY_ROLE:
                metadata = block.get("metadata") if isinstance(block.get("metadata"), dict) else {}
                number = str(metadata.get("toc_entry_number") or "").strip()
                title = text[len(number):].strip() if number and text.startswith(number) else text
                if title:
                    entries.append(TocEntry(id=block_id, title=title, number=number, level=int(metadata.get("toc_entry_level") or 1)))
            elif role in HEADING_ROLES and not skip_titles:
                headings.append(Heading(id=block_id, text=text))
    return entries, headings


def _input_digest(entries, headings, glossary, model_identity: dict) -> str:
    payload = {
        "prompt_version": PROMPT_VERSION,
        "model": model_identity,
        "entries": [[e.id, e.number, e.level, e.title] for e in entries],
        "headings": [[h.id, h.text] for h in headings],
        "glossary": [[t.source, t.target] for t in glossary],
    }
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def _read_cached(path: Path, digest: str) -> dict | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict) or payload.get("input_sha256") != digest:
        return None
    # 请求失败的不缓存成「定局」：下次再试
    return payload if payload.get("status") != "request_failed" else None


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=".toc-agent-", delete=False) as stream:
        json.dump(payload, stream, ensure_ascii=False, indent=2)
        temporary = Path(stream.name)
    os.replace(temporary, path)


def glossary_terms(entries: Iterable[Any]) -> list[GlossaryTerm]:
    terms = []
    for entry in entries or []:
        source = str(getattr(entry, "source", "") or (entry.get("source") if isinstance(entry, dict) else "") or "").strip()
        target = str(getattr(entry, "target", "") or (entry.get("target") if isinstance(entry, dict) else "") or "").strip()
        if source and target:
            terms.append(GlossaryTerm(source=source, target=target))
    return terms


def toc_fixed_translations(
    document: dict,
    *,
    output_dir: Path,
    chat_fn: Callable[..., Any],
    model_identity: dict,
    glossary_entries: Iterable[Any] = (),
    skip_titles: bool = False,
) -> dict[str, str]:
    """返回 {块号: 定译}。没有目录条目时不发请求、不写文件，返回空。"""
    entries, headings = collect(document, skip_titles=skip_titles)
    if not entries:
        return {}
    glossary = glossary_terms(glossary_entries)
    digest = _input_digest(entries, headings, glossary, model_identity)
    path = Path(output_dir) / RESULT_FILE_NAME
    cached = _read_cached(path, digest)
    if cached is not None:
        print(f"toc agent: reuse {len(cached.get('fixed_translations') or {})} fixed translations", flush=True)
        return dict(cached.get("fixed_translations") or {})
    result = translate_toc(entries, headings, chat_fn=chat_fn, glossary=glossary)
    record = {"schema": SCHEMA, "input_sha256": digest, "entries": len(entries), **result.to_record()}
    _write(path, record)
    print(
        f"toc agent: status={result.status} entries={len(entries)} titles={len(result.titles)} "
        f"rejected={len(result.rejected)} headings={result.matched_headings} requests={result.requests}",
        flush=True,
    )
    return dict(result.fixed_translations)


__all__ = ["RESULT_FILE_NAME", "collect", "glossary_terms", "toc_fixed_translations"]
