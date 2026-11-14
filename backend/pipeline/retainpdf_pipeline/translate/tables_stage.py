"""表格翻译（T3，先只看文字）：正文翻完以后，一张张翻表格，结果写 ``translated/tables.v1.json``。

开关 ``translation.tables``：``keep``（默认，什么都不做）/ ``translate``。

每张表：document.v1 的表格块 + 原文 PDF 那一页 → 表格模型（``ocr/tables``，T1）→ 表格 agent（翻译包）。
- 术语记忆：术语表 → 正文翻译的 job-memory → 前面的表，后翻的表查得到；
- 续跑：上次的 ``tables.v1.json`` 里同一张表（缓存键一样：引擎、提示词版本、格子、表题表注）的结果直接用，不再请求；
- Key 被上游拒（401/402/403）立刻停整个任务；别的请求错误只让这张表保留原文，原因写进结果。

阅读页、PDF 怎么用这份结果是 T4、T5 的事；这里只产出。
"""
from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

import fitz

from retainpdf_pipeline.ocr.tables import build_table_model
from retainpdf_translation.public import TABLE_PROMPT_VERSION
from retainpdf_translation.public import TABLE_STATUS_TRANSLATED
from retainpdf_translation.public import GlossaryEntry
from retainpdf_translation.public import credential_rejected_error
from retainpdf_translation.public import is_credential_rejection
from retainpdf_translation.public import TableContext
from retainpdf_translation.public import TableResult
from retainpdf_translation.public import TableTermMemory
from retainpdf_translation.public import table_cache_key
from retainpdf_translation.public import table_chat_fn
from retainpdf_translation.public import translate_table
from retainpdf_translation.public import translated_table_html

TABLES_FILE_NAME = "tables.v1.json"
TABLES_SCHEMA = "tables.v1"
TABLE_MODES = ("keep", "translate")
JOB_MEMORY_FILE_NAME = "job-memory.json"


def _blocks_by_page(document: dict) -> list[tuple[int, list[dict]]]:
    pages = []
    for index, page in enumerate(document.get("pages") or []):
        page_index = int(page.get("page_index", index) if isinstance(page, dict) else index)
        pages.append((page_index, list(page.get("blocks") or []) if isinstance(page, dict) else []))
    return pages


def _is_table(block: dict) -> bool:
    return str(block.get("type") or "") == "table" or str(block.get("block_class") or "") == "table"


def _context(blocks: list[dict], index: int) -> TableContext:
    """表题：表格前面最近的 table_caption（最多往前看 3 块），没有就看后面；表注：紧跟在后面的 table_footnote。"""
    caption = ""
    for block in reversed(blocks[max(0, index - 3):index]):
        if str(block.get("sub_type") or "") == "table_caption":
            caption = str(block.get("text") or "")
            break
    footnotes: list[str] = []
    for block in blocks[index + 1:index + 6]:
        sub_type = str(block.get("sub_type") or "")
        if sub_type == "table_footnote":
            footnotes.append(str(block.get("text") or ""))
        elif sub_type == "table_caption" and not caption:
            caption = str(block.get("text") or "")
        else:
            break
    return TableContext(caption=" ".join(caption.split()), footnotes=" ".join(" ".join(footnotes).split()))


def _body_terms(translated_dir: Path) -> list[tuple[str, str]]:
    path = translated_dir / JOB_MEMORY_FILE_NAME
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    terms = []
    for record in (payload.get("terms") or {}).values():
        if isinstance(record, dict) and record.get("prompt_eligible"):
            terms.append((str(record.get("key") or ""), str(record.get("value") or "")))
    return terms


def _previous(path: Path) -> dict[str, dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    # 请求失败而保留原文的不复用：下次重跑要再试
    return {
        str(entry.get("cache_key")): entry
        for entry in payload.get("tables") or []
        if entry.get("cache_key") and not str((entry.get("result") or {}).get("reason") or "").startswith("request_failed")
    }


def translate_tables(
    *,
    source_json_path: Path,
    source_pdf_path: Path | None,
    output_dir: Path,
    api_key: str,
    model: str,
    base_url: str,
    glossary_entries: list[GlossaryEntry] | None = None,
    start_page: int = 0,
    end_page: int = -1,
    chat_fn=None,  # noqa: ANN001 - 测试注入
) -> dict[str, Any]:
    """翻这本书的表格，写 ``output_dir/tables.v1.json``，返回摘要（写进翻译结果的 ``tables``）。"""
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / TABLES_FILE_NAME
    summary: Counter = Counter()
    if source_pdf_path is None or not Path(source_pdf_path).exists():
        return {"mode": "translate", "skipped_reason": "source_pdf_missing"}
    if not Path(source_json_path).exists():
        return {"mode": "translate", "skipped_reason": "document_missing"}
    document = json.loads(Path(source_json_path).read_text(encoding="utf-8"))
    previous = _previous(path)
    memory = TableTermMemory()
    memory.add_glossary([(entry.source, entry.target) for entry in glossary_entries or [] if entry.target])
    memory.add_body_terms(_body_terms(output_dir))
    chat = chat_fn or table_chat_fn(model=model, base_url=base_url, api_key=api_key)
    engine = f"{model}@{base_url}"
    entries: list[dict] = []
    pdf = fitz.open(source_pdf_path)
    try:
        for page_index, blocks in _blocks_by_page(document):
            if page_index < start_page or (end_page >= 0 and page_index > end_page) or page_index >= pdf.page_count:
                continue
            for index, block in enumerate(blocks):
                if not _is_table(block):
                    continue
                table_model = build_table_model(block, pdf[page_index])
                context = _context(blocks, index)
                key = table_cache_key(table_model, context, engine=engine)
                cached = previous.get(key)
                if cached is not None:
                    result = TableResult.from_dict(cached.get("result") or {})
                    summary["cache_hits"] += 1
                else:
                    try:
                        result = translate_table(table_model, chat_fn=chat, memory=memory, context=context)
                    except Exception as error:  # noqa: BLE001 - 一张表失败不连累整本；Key 失效另外判
                        if is_credential_rejection(error):
                            raise credential_rejected_error(error) from error
                        result = TableResult(block_id=str(block.get("block_id") or ""), status="kept",
                                             reason=f"request_failed:{type(error).__name__}")
                result.cache_key = key
                if result.status == TABLE_STATUS_TRANSLATED:
                    for cell_id, translation in result.translations().items():
                        memory.add(result.cells[cell_id]["source"], translation)
                summary["tables"] += 1
                summary[f"status:{result.status}"] += 1
                entries.append(
                    {
                        "block_id": block.get("block_id"),
                        "page_index": page_index,
                        "bbox": table_model.get("bbox"),
                        "cache_key": key,
                        "caption": context.caption,
                        "model": table_model,
                        "result": result.as_dict(),
                        "translated_html": translated_table_html(table_model, result)
                        if result.status == TABLE_STATUS_TRANSLATED
                        else None,
                    }
                )
                _write(path, entries, summary, engine=engine)
    finally:
        pdf.close()
    _write(path, entries, summary, engine=engine)
    return {"mode": "translate", "path": str(path), **dict(summary)}


def _write(path: Path, entries: list[dict], summary: Counter, *, engine: str) -> None:
    payload = {
        "schema": TABLES_SCHEMA,
        "prompt_version": TABLE_PROMPT_VERSION,
        "engine": engine,
        "summary": dict(summary),
        "tables": entries,
    }
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(temp, path)


__all__ = ["TABLES_FILE_NAME", "TABLE_MODES", "translate_tables"]
