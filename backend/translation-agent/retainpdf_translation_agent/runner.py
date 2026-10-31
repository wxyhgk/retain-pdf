"""调度（程序角色）：整篇按页顺序翻，带术语记忆和上下文包；写台账和进度，中断后接着跑。

    run = DocumentRun(agent, Path("state"), glossary=user_glossary, style="……")
    outcome = run.run(pages)          # pages: list[PageInput]，按阅读顺序
    run.run(pages, on_page=写回)       # 每页做完（含续跑时读回的页）调一次 写回(页序号, PageInput, {块 id: BlockResult})

状态目录里：
- `progress.json`：做完了哪些页、状态（running / done / stopped）和停下的原因。缓存不算进度，进度只看这个文件。
- `pages/NNNN.json`：每页的结果（`BlockResult.to_dict()`）和 agent 交卷时附带的东西（术语、例外、备注）。
- `glossary.json`：术语表现在的样子；`glossary/vN.json`：每个版本的快照，写了就不改。
- `ledger.jsonl`：台账，只追加。每次请求一行、术语表每次变动一行、每页做完一行、停下一行。
- `events.jsonl`：编辑部事件（`editorial.v1`，格式见 docs/ops/planning/translation-agent/20261030-编辑部可视化和事件格式.md），
  只追加，给前端画"编辑部"。和台账同时写；续跑接着往后写（会再有一条 run_started）。`page` 是这次跑的第几页（1 起），通读是 0。

开始前程序先扫一遍全文抓"全称 (缩写)"，所以缩写先用后定义也认得。每页翻完，把译者报上的术语交给术语表：
块要过了校验、原文里确实有这个词（找不到出处的丢掉）才算数。额度用完、密钥不对、一直限流（`StopRun`）就保存进度停下。
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from dataclasses import replace
from pathlib import Path
from typing import Callable

from retainpdf_translation_agent.agent import PROMPT_VERSION
from retainpdf_translation_agent.agent import StopRun
from retainpdf_translation_agent.agent import TranslationAgent
from retainpdf_translation_agent.checks import CJK_RE
from retainpdf_translation_agent.context import DEFAULT_BUDGET
from retainpdf_translation_agent.context import build_context
from retainpdf_translation_agent.contract import CONTRACT_VERSION
from retainpdf_translation_agent.contract import STATUS_OK
from retainpdf_translation_agent.contract import STATUS_WARN
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.memory import ABBR
from retainpdf_translation_agent.memory import APPROVED
from retainpdf_translation_agent.memory import KEEP
from retainpdf_translation_agent.memory import NAME
from retainpdf_translation_agent.memory import TERM
from retainpdf_translation_agent.memory import Glossary
from retainpdf_translation_agent.memory import extract_abbreviations
from retainpdf_translation_agent.memory import quote_around
from retainpdf_translation_agent.memory import term_pattern
from retainpdf_translation_agent.reader import Reading
from retainpdf_translation_agent.reader import apply_reading
from retainpdf_translation_agent.reader import read_document
from retainpdf_translation_agent.review import review_page
from retainpdf_translation_agent.review import reviewable
from retainpdf_translation_agent.units import merge_groups
from retainpdf_translation_agent.units import split_units

TRAILING_PARENS_RE = re.compile(r"\s*[（(][^（）()]*[)）]\s*$")

EDITORIAL_EVENT_VERSION = "editorial.v1"
EVENTS_FILE = "events.jsonl"

DONE = "done"
STOPPED = "stopped"
RUNNING = "running"


@dataclass
class RunOutcome:
    status: str  # done / stopped
    stop_reason: str
    results: dict[str, BlockResult]  # 做完的页的全部块
    glossary: Glossary
    pages_done: int
    pages_total: int


class DocumentRun:
    def __init__(
        self,
        agent: TranslationAgent,
        state_dir: Path,
        *,
        glossary: Glossary | None = None,
        style: str = "",
        summaries: dict[str, str] | None = None,
        budget: int = DEFAULT_BUDGET,
        memory: bool = True,
        read_first: bool = False,
        review: bool = False,
    ) -> None:
        """`memory=False` 时不带上下文包、不记术语（和第 1 版以前一样），用来做对比。
        `read_first=True` 时先通读整篇（`reader.py`）：定体裁、文风、全文统一的术语和人名、全部标题的译法，再逐页翻。
        `review=True` 时每页翻完审校一遍（`review.py`），按问题单改被指出的片段。"""
        self.agent = agent
        self.state_dir = Path(state_dir)
        self.initial_glossary = glossary
        self.style = style
        self.summaries = dict(summaries or {})
        self.budget = budget
        self.memory = memory
        self.read_first = read_first and memory
        self.reading: Reading | None = None
        self.review = review
        self._event_page = 0  # 编辑部事件里的页号：正在做第几页（1 起），通读是 0
        self._tickets_seen = 0

    # ---- 状态文件 ----
    def _path(self, *parts: str) -> Path:
        return self.state_dir.joinpath(*parts)

    def _write_json(self, path: Path, data) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        tmp.replace(path)

    def _ledger(self, event: str, **fields) -> None:
        path = self._path("ledger.jsonl")
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"ts": round(time.time(), 3), "event": event, **fields}, ensure_ascii=False) + "\n")

    def _event(self, event_type: str, **fields) -> None:
        path = self._path(EVENTS_FILE)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"v": EDITORIAL_EVENT_VERSION, "ts": round(time.time(), 3), "type": event_type, **fields}, ensure_ascii=False) + "\n")

    def _agent_event(self, event_type: str, fields: dict) -> None:
        self._event(event_type, page=self._event_page, **fields)

    def _stopped(self, page: PageInput, key: str, stop: StopRun, done: list[str], total: int) -> None:
        self._ledger("stop", page=page.page_label, page_key=key, reason=stop.reason, message=str(stop)[:300])
        self._event("run_stopped", reason=stop.reason)
        self._progress(done, STOPPED, stop.reason, total)

    def _save_glossary(self, glossary: Glossary, since: int) -> None:
        for change in glossary.changes[since:]:
            self._ledger("glossary", **change)
            self._event("glossary_changed", version=change["version"], action=change["action"], source=change["source"], target=change["target"])
        for ticket in glossary.tickets[self._tickets_seen :]:
            self._event("ticket_opened", term=ticket["source"], current=ticket["current"], proposed=ticket["proposed"], page=self._event_page)
        self._tickets_seen = len(glossary.tickets)
        self._write_json(self._path("glossary.json"), glossary.to_dict())
        snapshot = self._path("glossary", f"v{glossary.version}.json")
        if not snapshot.exists():
            self._write_json(snapshot, glossary.to_dict())

    def _progress(self, done: list[str], status: str, reason: str = "", total: int = 0) -> None:
        self._write_json(self._path("progress.json"), {"status": status, "stop_reason": reason, "pages_done": done, "pages_total": total})

    # ---- 跑 ----
    def run(self, pages: list[PageInput], *, on_page: Callable[[int, PageInput, dict[str, BlockResult]], None] | None = None) -> RunOutcome:
        """`on_page`：每页做完调一次（续跑时读回的页也调），正式流程在这里把译文写回、提交断点。"""
        self.agent.on_event = self._agent_event
        try:
            return self._run(pages, on_page)
        finally:
            self.agent.on_event = None

    def _run(self, pages: list[PageInput], on_page: Callable[[int, PageInput, dict[str, BlockResult]], None] | None) -> RunOutcome:
        progress_path = self._path("progress.json")
        progress = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else {}
        done: list[str] = list(progress.get("pages_done") or [])
        self._event_page = 0
        title = str((pages[0].document or {}).get("title") or "") if pages else ""
        self._event("run_started", pages=len(pages), model=self.agent.model, doc_title=title, resumed=len(done))
        if self._path("glossary.json").exists():
            glossary = Glossary.from_dict(json.loads(self._path("glossary.json").read_text(encoding="utf-8")))
            self._tickets_seen = len(glossary.tickets)
            if self._path("reading.json").exists():
                self.reading = Reading.from_dict(json.loads(self._path("reading.json").read_text(encoding="utf-8")))
        else:
            glossary = Glossary.from_dict(self.initial_glossary.to_dict()) if self.initial_glossary else Glossary()
            self._tickets_seen = 0
            if self.memory:
                self._prescan(glossary, pages)
            if self.read_first:
                calls_before = len(self.agent.calls)
                self._event("reading_started")
                try:
                    self.reading = read_document(self.agent, pages)
                except StopRun as stop:
                    self._stopped(PageInput(page_label="", blocks=[]), "read", stop, done, len(pages))
                    return RunOutcome(STOPPED, stop.reason, {}, glossary, 0, len(pages))
                self._log_calls(PageInput(page_label="", blocks=[]), "read", {}, calls_before)
                self._write_json(self._path("reading.json"), self.reading.to_dict())
                self._ledger("read", genre=self.reading.genre, name_policy=self.reading.name_policy, terms=len(self.reading.terms), headings=len(self.reading.headings), candidates=self.reading.candidates)
                self._event("reading_done", genre=self.reading.genre, name_policy=self.reading.name_policy, terms=len(self.reading.terms), headings=len(self.reading.headings))
            self._save_glossary(glossary, 0)
        if self.reading is not None:
            if not self._path("glossary", "read.done").exists():
                before = len(glossary.changes)
                pages = apply_reading(self.reading, glossary, pages)
                self._save_glossary(glossary, before)
                self._write_json(self._path("glossary", "read.done"), {"version": glossary.version})
            else:
                pages = apply_reading(self.reading, Glossary(), pages)  # 术语已经登记过，只要标题的已定译文
            if not self.style:
                self.style = self.reading.style_text()
        self._ledger("start", pages=len(pages), resumed=len(done), prompt_version=PROMPT_VERSION, contract_version=CONTRACT_VERSION, memory=self.memory)

        results: dict[str, BlockResult] = {}
        previous: list[dict] = []
        seen_abbreviations: set[str] = set()
        # 缩写和人名：全书第一次用到要写全称、"中文译名（原文）"，之后不用
        abbreviations = [t.source for t in glossary.terms.values() if t.category in (ABBR, NAME)]
        for index, page in enumerate(pages):
            key = f"{index:04d}"
            if key in done:
                page_results = {
                    r["id"]: BlockResult(r["id"], r["translation"], r["issues"], r["attempts"], r["status"], r.get("history") or [], r.get("meta") or {})
                    for r in json.loads(self._path("pages", f"{key}.json").read_text(encoding="utf-8"))["results"]
                }
            else:
                next_page = pages[index + 1] if index + 1 < len(pages) else None
                context = {}
                if self.memory:
                    context = build_context(
                        page,
                        glossary,
                        previous=previous,
                        next_blocks=[{"id": b.id, "source": b.text} for b in (next_page.to_translate() if next_page else [])],
                        style=self.style,
                        summary=self.summaries.get(page.chapter, ""),
                        used_abbreviations=seen_abbreviations,
                        budget=self.budget,
                    )
                page_input = replace(page, context=context)
                calls_before = len(self.agent.calls)
                changes_before = len(glossary.changes)
                self._event_page = index + 1
                self._event("page_started", page=self._event_page, label=page.page_label, blocks=len(page.to_translate()))
                # 接续组合成一块翻、审校，审完才切回各块（`units.py`）
                units, groups = merge_groups(page_input)
                try:
                    unit_results, info = self.agent.translate_units(units)
                except StopRun as stop:
                    self._log_calls(page, key, context, calls_before)
                    self._stopped(page, key, stop, done, len(pages))
                    return RunOutcome(STOPPED, stop.reason, results, glossary, len(done), len(pages))
                review_report = None
                if self.review:
                    reviewed = reviewable(units, unit_results)
                    self._event("review_started", page=self._event_page, blocks=sum(len(b.members) or 1 for b in reviewed))
                    try:
                        review_report = review_page(self.agent, units, unit_results)
                    except StopRun as stop:
                        self._log_calls(page, key, context, calls_before)
                        self._stopped(page, key, stop, done, len(pages))
                        return RunOutcome(STOPPED, stop.reason, results, glossary, len(done), len(pages))
                    info["review"] = review_report
                    self._event(
                        "review_done",
                        page=self._event_page,
                        tickets=review_report["tickets"],
                        applied=len(review_report["applied"]),
                        rejected=len(review_report["rejected"]),
                    )
                page_results = split_units(unit_results, groups)
                self._log_calls(page, key, context, calls_before)
                if review_report is not None:
                    self._ledger("review", page=page.page_label, page_key=key, reviewed=review_report["reviewed"], tickets=review_report["tickets"], applied=len(review_report["applied"]))
                if self.memory:
                    self._learn(glossary, page_input, page_results, info)
                self._save_glossary(glossary, changes_before)
                self._write_json(
                    self._path("pages", f"{key}.json"),
                    {"page": page.page_label, "chapter": page.chapter, "context": context, "info": info, "results": [r.to_dict() for r in page_results.values()]},
                )
                statuses: dict[str, int] = {}
                for result in page_results.values():
                    statuses[result.status] = statuses.get(result.status, 0) + 1
                self._ledger("page", page=page.page_label, page_key=key, statuses=statuses, glossary_version=glossary.version)
                self._event("page_done", page=self._event_page, statuses={"ok": 0, "warn": 0, "error": 0, "fallback_source": 0, **statuses})
                done.append(key)
                self._progress(done, RUNNING, total=len(pages))
            results.update(page_results)
            if on_page is not None:
                on_page(index, page, page_results)
            text = " ".join(b.text for b in page.to_translate())
            seen_abbreviations |= {a for a in abbreviations if term_pattern(a, ABBR).search(text)}
            previous = [
                {"id": b.id, "source": b.text, "translation": page_results[b.id].translation}
                for b in page.to_translate()
                if b.id in page_results and page_results[b.id].translation
            ]
        self._progress(done, DONE, total=len(pages))
        self._ledger("done", pages=len(pages), glossary_version=glossary.version, tickets=len(glossary.tickets))
        self._event("run_done", pages=len(pages), glossary_version=glossary.version, tickets=len(glossary.tickets))
        return RunOutcome(DONE, "", results, glossary, len(done), len(pages))

    def _log_calls(self, page: PageInput, key: str, context: dict, since: int) -> None:
        for call in self.agent.calls[since:]:
            usage = call.get("usage") or {}
            self._ledger(
                "call",
                page=page.page_label,
                page_key=key,
                label=call["label"],
                role=call.get("role"),
                model=call.get("model"),
                prompt_version=PROMPT_VERSION,
                glossary_version=context.get("glossary_version"),
                context_hash=context.get("hash"),
                context_tokens=context.get("estimated_tokens"),
                cached=call["cached"],
                latency_ms=call["latency_ms"],
                input_tokens=usage.get("input_tokens"),
                output_tokens=usage.get("output_tokens"),
                cache_read_input_tokens=usage.get("cache_read_input_tokens"),
                cache_creation_input_tokens=usage.get("cache_creation_input_tokens"),
            )

    @staticmethod
    def _prescan(glossary: Glossary, pages: list[PageInput]) -> None:
        """全文扫一遍"全称 (缩写)"，第一次出现的那处记成缩写的定义。"""
        for page in pages:
            for block in page.to_translate():
                for abbr, expansion in extract_abbreviations(block.text):
                    if glossary.find(abbr, page.chapter, category=ABBR) is None:
                        glossary.add(
                            abbr,
                            abbr,
                            category=ABBR,
                            status=APPROVED,
                            reason="程序抓到“全称 (缩写)”",
                            page=page.page_label,
                            quote=quote_around(block.text, abbr),
                            note=expansion,
                        )

    @staticmethod
    def _learn(glossary: Glossary, page: PageInput, results: dict[str, BlockResult], info: dict) -> None:
        """把译者报上的术语、例外交给术语表。块要过了校验，原文里要真有这个词。"""
        blocks = {b.id: b for b in page.to_translate()}
        groups: dict[str, list] = {}
        for block in page.to_translate():
            if block.group:
                groups.setdefault(block.group["id"], []).append(block)

        def evidence(block_id: str, source: str):
            members = groups.get(block_id) or ([blocks[block_id]] if block_id in blocks else [])
            for block in members:
                result = results.get(block.id)
                if result is None or result.status not in (STATUS_OK, STATUS_WARN):
                    continue
                quote = quote_around(block.text, source)
                if quote:
                    return block, quote
            return None, ""

        for item in info.get("terms") or []:
            # 括号里的缩写不算译法的一部分："光学字符识别（OCR）" → "光学字符识别"
            source = TRAILING_PARENS_RE.sub("", str(item.get("source", ""))).strip()
            target = TRAILING_PARENS_RE.sub("", str(item.get("target", ""))).strip()
            category = KEEP if item.get("category") == KEEP or source == target else TERM
            if not source or not target or (category == TERM and not CJK_RE.search(target)):
                continue
            if glossary.find(source, page.chapter, category=ABBR) is not None:
                continue  # 缩写已经由程序登记
            block, quote = evidence(str(item.get("block_id", "")), source)
            if block is not None:
                glossary.propose(source, target, category=category, block_id=block.id, page=page.page_label, chapter=page.chapter, quote=quote)
        for item in info.get("term_exceptions") or []:
            source, used = str(item.get("source", "")).strip(), str(item.get("used", "")).strip()
            if not source or not used:
                continue
            block, quote = evidence(str(item.get("block_id", "")), source)
            if block is not None:
                glossary.declare_exception(
                    source, used, block_id=block.id, page=page.page_label, chapter=page.chapter, quote=quote, reason=str(item.get("reason", ""))[:200]
                )


def blocks_using(results: dict[str, BlockResult], term_id: str) -> list[str]:
    """哪些块的译文用到了这条术语（看 `meta.used_terms`）：术语改了只回头处理这些块。"""
    return sorted(block_id for block_id, result in results.items() if any(used[0] == term_id for used in (result.meta or {}).get("used_terms") or []))
