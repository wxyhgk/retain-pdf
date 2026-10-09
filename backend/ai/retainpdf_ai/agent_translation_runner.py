"""把一条 `retainpdf-agent translation ...` 变成若干次单请求 CLI 调用，并整理输出。

为什么组合逻辑放在宿主这边：真正的 CLI（Rust 的 retainpdf-agent）每次只发一个
HTTP 请求、只拿一张单动作 capability。「issues」要合并 QA 和精修两份报告，
「term-set」要先读术语表、改完再写回、再扫一遍译文找受影响的块 —— 这些步骤
拆成多次 CLI 调用，每次各自申请 capability，Rust 侧的授权粒度就不用变粗。

输出是给 agent 直接读的 JSON（终端里不能用管道接 jq，所以输出本身要好读、
够短）：失败时 exit_code=1，stderr 里写清楚原因和后端返回的要点。
"""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .agent_broker_contracts import BrokerCommand
from .agent_translation_commands import SEVERITY_RANK

#: 由 term-set 新建的术语表的名字前缀（后接任务 id）。任务本身没用术语表时用它。
JOB_GLOSSARY_NAME_PREFIX = "本书术语 "

_MAX_REVISIONS_SHOWN = 10
_MAX_AFFECTED_SHOWN = 200
_EXCERPT_RADIUS = 60
_TEXT_PREVIEW_CHARS = 240
_SAFE_PAGE_FILE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.json$")


@dataclass(frozen=True)
class CliResult:
    """一次 CLI 调用的结果（CLI 的 retainpdf_agent_cli_response_v1 信封拆开后）。"""

    ok: bool
    http_status: int | None
    response: Any
    message: str = ""

    @property
    def data(self) -> Any:
        if isinstance(self.response, dict):
            return self.response.get("data")
        return None


#: (capability 动作, CLI argv, 请求体或 None) -> 结果
CliCall = Callable[[str, tuple[str, ...], dict[str, Any] | None], CliResult]


class TranslationCommandError(Exception):
    def __init__(self, message: str, result: CliResult | None = None) -> None:
        super().__init__(message)
        self.result = result


class TranslationCommandRunner:
    def __init__(self, *, job_id: str, job_dir: Path | None, call: CliCall) -> None:
        self._job_id = job_id
        self._job_dir = job_dir
        self._call = call

    def run(self, command: BrokerCommand) -> dict[str, Any]:
        params = dict(command.request_payload or {})
        handlers: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
            "translation.issues": self._issues,
            "translation.show": self._show,
            "translation.revise": self._revise,
            "translation.refine": self._refine,
            "translation.rerender": self._rerender,
            "translation.term-set": self._term_set,
        }
        handler = handlers.get(command.action)
        if handler is None:
            return _failure({"error": "unsupported translation command"})
        try:
            payload = handler(params)
        except TranslationCommandError as exc:
            detail: dict[str, Any] = {"error": str(exc)}
            if exc.result is not None:
                detail.update(_backend_detail(exc.result))
            return _failure(detail)
        return {
            "exit_code": 0,
            "stdout": json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            "stderr": "",
        }

    # ------------------------------------------------------------------ issues

    def _issues(self, params: dict[str, Any]) -> dict[str, Any]:
        qa = self._read(("translation", "qa"))
        refine = self._read(("translation", "refine-report"))
        sources = {"translation_qa": _source_status(qa), "refine_report": _source_status(refine)}
        issues: list[dict[str, Any]] = []
        qa_report = _report(qa)
        if qa_report is not None:
            issues.extend(_qa_issues(qa_report))
        refine_report = _report(refine)
        refine_summary = None
        if refine_report is not None:
            issues.extend(
                _refine_issues(refine_report, include_qa_origin=qa_report is None)
            )
            refine_summary = _refine_summary(refine_report)
        pages = params.get("pages")
        min_severity = params.get("min_severity")
        filtered = [
            issue
            for issue in issues
            if _in_pages(issue.get("page"), pages)
            and (
                min_severity is None
                or SEVERITY_RANK.get(str(issue.get("severity")), 99)
                <= SEVERITY_RANK[min_severity]
            )
        ]
        filtered.sort(
            key=lambda issue: (
                issue.get("page") if isinstance(issue.get("page"), int) else 10**9,
                SEVERITY_RANK.get(str(issue.get("severity")), 99),
                str(issue.get("item_id") or ""),
            )
        )
        limit = int(params.get("limit") or 50)
        payload: dict[str, Any] = {
            "job_id": self._job_id,
            "sources": sources,
            "filter": {
                "pages": list(pages) if pages else None,
                "min_severity": min_severity,
            },
            "total": len(filtered),
            "shown": min(limit, len(filtered)),
            "by_severity": dict(Counter(str(issue.get("severity")) for issue in filtered)),
            "by_origin": dict(Counter(str(issue.get("origin")) for issue in filtered)),
            "issues": filtered[:limit],
        }
        if refine_summary is not None:
            payload["refine"] = refine_summary
        if len(filtered) > limit:
            payload["note"] = "只列了前面一部分；用 --pages 缩小范围或加大 --limit。"
        if qa_report is None and refine_report is None:
            payload["note"] = (
                "这本书还没有 QA 报告和精修报告（老任务或渲染尚未完成）。"
                "可以直接看译文，或用 retainpdf-agent translation refine --review-only 先挑一遍错。"
            )
        return payload

    # ------------------------------------------------------------------ show

    def _show(self, params: dict[str, Any]) -> dict[str, Any]:
        item_id = params["item_id"]
        result = self._read(("translation", "item", "--item-id", item_id))
        if not result.ok:
            raise TranslationCommandError(f"读不到块 {item_id}", result)
        data = result.data if isinstance(result.data, dict) else {}
        item = data.get("item") if isinstance(data.get("item"), dict) else {}
        translated = str(item.get("translated_text") or "")
        protected = str(item.get("protected_translated_text") or "")
        payload: dict[str, Any] = {
            "job_id": self._job_id,
            "item_id": item_id,
            "page": data.get("page_number"),
            "block_type": item.get("block_type"),
            "final_status": item.get("final_status"),
            "math_mode": item.get("math_mode"),
            "source_text": item.get("source_text"),
            "translated_text": translated,
        }
        if protected and protected != translated:
            payload["protected_translated_text"] = protected
            payload["note_protected"] = (
                "protected_translated_text 里的 <f1-xxx/>、[[FORMULA_1]] 是公式占位符；"
                "revise 时以它为底稿最稳，占位符要逐字保留。"
            )
        unit_id = str(item.get("translation_unit_id") or "")
        if unit_id.startswith("__cg__"):
            payload["translation_unit_id"] = unit_id
            payload["note_group"] = (
                "这一块属于跨块连续段：改它会重建整段，可能波及相邻块或别的页。"
            )
        history = self._read(("translation", "revisions", "--item-id", item_id))
        if history.ok and isinstance(history.data, dict):
            revisions = [
                _revision_view(record)
                for record in history.data.get("revisions") or []
                if isinstance(record, dict)
            ]
            payload["revision_total"] = len(revisions)
            payload["revisions"] = revisions[-_MAX_REVISIONS_SHOWN:]
        else:
            payload["revision_total"] = None
            payload["revisions_error"] = history.message or "修订历史读取失败"
        return payload

    # ------------------------------------------------------------------ revise

    def _revise(self, params: dict[str, Any]) -> dict[str, Any]:
        item_id = params["item_id"]
        body = {
            "translated_text": params["text"],
            "source": "agent",
            "reason": params["reason"],
            "rerender": False,
        }
        result = self._call(
            "translation.revise",
            ("translation", "revise", "--job-id", self._job_id, "--item-id", item_id),
            body,
        )
        if not result.ok:
            raise TranslationCommandError(_revise_failure_message(result), result)
        data = result.data if isinstance(result.data, dict) else {}
        validation = data.get("validation") if isinstance(data.get("validation"), dict) else {}
        revision = data.get("revision") if isinstance(data.get("revision"), dict) else {}
        live = data.get("live_publication") if isinstance(data.get("live_publication"), dict) else {}
        return {
            "job_id": self._job_id,
            "item_id": item_id,
            "changed": data.get("changed"),
            "generation": data.get("generation"),
            "revision_id": revision.get("revision_id"),
            "validation": {
                "passed": validation.get("passed"),
                "error_count": validation.get("error_count"),
                "warning_count": validation.get("warning_count"),
                "issues": [
                    {
                        "kind": issue.get("kind"),
                        "severity": issue.get("severity"),
                        "message": issue.get("message"),
                    }
                    for issue in validation.get("issues") or []
                    if isinstance(issue, dict)
                ],
            },
            "live_publication": live.get("status"),
            "next": (
                "已写回，PDF 还没变。全部改完后执行一次 retainpdf-agent translation rerender。"
                if data.get("changed")
                else "新译文和现有的一样，没有写入。"
            ),
        }

    # ------------------------------------------------------------------ refine / rerender

    def _refine(self, params: dict[str, Any]) -> dict[str, Any]:
        refine: dict[str, Any] = {
            "mode": "review_only" if params.get("review_only") else "review_and_fix"
        }
        pages = params.get("pages")
        if pages:
            refine["start_page"], refine["end_page"] = pages
        body = {"stage": "refine", "create_new_job": False, "refine": refine}
        submission = self._retry(body, "精修")
        submission["next"] = (
            "已提交，后台在跑（挑错"
            + ("" if params.get("review_only") else " + 定点修改 + 重渲染")
            + "）。几分钟后用 retainpdf-agent translation issues 看 refine 一栏的结果。"
        )
        return submission

    def _rerender(self, _params: dict[str, Any]) -> dict[str, Any]:
        submission = self._retry({"stage": "render", "create_new_job": False}, "重渲染")
        submission["next"] = "已提交原地重渲染，完成后 ../rendered/ 里的 PDF 和 QA 报告会更新。"
        return submission

    def _retry(self, body: dict[str, Any], label: str) -> dict[str, Any]:
        result = self._call(
            "translation.retry",
            ("translation", "retry-stage", "--job-id", self._job_id),
            body,
        )
        if not result.ok:
            if result.http_status == 409:
                raise TranslationCommandError(
                    f"{label}没有提交：任务正在运行，等它结束再试。", result
                )
            raise TranslationCommandError(f"{label}没有提交", result)
        data = result.data if isinstance(result.data, dict) else {}
        return {
            "job_id": data.get("job_id") or self._job_id,
            "status": data.get("status"),
            "workflow": data.get("workflow"),
            "rerun_stages": data.get("rerun_stages"),
            "reused_artifacts": data.get("reused_artifacts"),
        }

    # ------------------------------------------------------------------ term-set

    def _term_set(self, params: dict[str, Any]) -> dict[str, Any]:
        source = params["source"]
        target = params["target"]
        glossary, created = self._job_glossary()
        entries = [
            dict(entry) for entry in glossary.get("entries") or [] if isinstance(entry, dict)
        ]
        key = source.casefold()
        replaced = False
        previous_target = None
        for entry in entries:
            if str(entry.get("source") or "").strip().casefold() == key:
                previous_target = entry.get("target")
                entry["source"] = source
                entry["target"] = target
                entry["level"] = "canonical"
                replaced = True
        if not replaced:
            entries.append(
                {
                    "source": source,
                    "target": target,
                    "note": "终端 agent 用 term-set 写入",
                    "level": "canonical",
                    "match_mode": "case_insensitive",
                    "context": "",
                }
            )
        body = {
            "name": glossary.get("name") or f"{JOB_GLOSSARY_NAME_PREFIX}{self._job_id}",
            "description": glossary.get("description") or "",
            "source_lang": glossary.get("source_lang") or "",
            "target_lang": glossary.get("target_lang") or "",
            "enabled": bool(glossary.get("enabled", True)),
            "entries": [_entry_input(entry) for entry in entries],
        }
        glossary_id = str(glossary.get("glossary_id") or "")
        if glossary_id:
            write = self._call(
                "glossary.write",
                ("glossary", "update", "--glossary-id", glossary_id),
                body,
            )
        else:
            write = self._call("glossary.write", ("glossary", "create"), body)
        if not write.ok:
            raise TranslationCommandError("术语没有写进术语表", write)
        written = write.data if isinstance(write.data, dict) else {}
        affected, consistent, scanned = self._scan_affected(source, target)
        payload: dict[str, Any] = {
            "job_id": self._job_id,
            "glossary": {
                "glossary_id": written.get("glossary_id") or glossary_id,
                "name": written.get("name") or body["name"],
                "created": created,
                "entry": {"source": source, "target": target, "level": "canonical"},
                "previous_target": previous_target,
            },
        }
        if affected is None:
            payload["affected"] = None
            payload["note"] = "读不到这本书的译文文件，没能列出受影响的块。"
            return payload
        payload["scan"] = {
            "blocks_containing_source": len(affected) + consistent,
            "already_using_target": consistent,
            "affected": len(affected),
            "pages_scanned": scanned,
        }
        payload["affected"] = affected[:_MAX_AFFECTED_SHOWN]
        payload["next"] = (
            "术语表已更新，但**没有**改任何译文。逐块 show 看原文、拟好改法，"
            "让用户确认后再逐个 revise，最后 rerender 一次。"
            "术语表只影响以后用它的翻译；这本书已有的译文要靠 revise 改。"
        )
        if len(affected) > _MAX_AFFECTED_SHOWN:
            payload["note"] = f"受影响的块太多，只列了前 {_MAX_AFFECTED_SHOWN} 个。"
        return payload

    def _job_glossary(self) -> tuple[dict[str, Any], bool]:
        """这本书用的术语表；没用的话找（或准备新建）一张「本书术语 <任务>」。

        返回 (术语表详情, 是否新建)。新建时详情里没有 glossary_id，由调用方 create。
        """
        glossary_id = self._manifest_glossary_id()
        if glossary_id:
            current = self._call(
                "glossary.read", ("glossary", "get", "--glossary-id", glossary_id), None
            )
            if current.ok and isinstance(current.data, dict):
                return current.data, False
            if current.http_status != 404:
                raise TranslationCommandError("读不到这本书的术语表", current)
        name = f"{JOB_GLOSSARY_NAME_PREFIX}{self._job_id}"
        listing = self._call("glossary.read", ("glossary", "list"), None)
        if not listing.ok:
            raise TranslationCommandError("读不到术语表列表", listing)
        items = listing.data.get("items") if isinstance(listing.data, dict) else None
        for summary in items or []:
            if isinstance(summary, dict) and summary.get("name") == name:
                found_id = str(summary.get("glossary_id") or "")
                current = self._call(
                    "glossary.read", ("glossary", "get", "--glossary-id", found_id), None
                )
                if current.ok and isinstance(current.data, dict):
                    return current.data, False
                raise TranslationCommandError("读不到这本书的术语表", current)
        return {"name": name, "description": "终端 agent 为这本书建的术语表", "entries": []}, True

    def _manifest_glossary_id(self) -> str:
        manifest = _load_json(self._translated_dir() / "translation-manifest.json")
        glossary = manifest.get("glossary") if isinstance(manifest, dict) else None
        if isinstance(glossary, dict):
            return str(glossary.get("glossary_id") or "").strip()
        return ""

    def _translated_dir(self) -> Path:
        return (self._job_dir or Path("/nonexistent")) / "translated"

    def _scan_affected(
        self, source: str, target: str
    ) -> tuple[list[dict[str, Any]] | None, int, int]:
        """原文里出现 source、译文里却没有 target 的块。只读，在宿主侧扫译文文件。"""
        page_files = self._page_files()
        if page_files is None:
            return None, 0, 0
        pattern = _term_pattern(source)
        affected: list[dict[str, Any]] = []
        consistent = 0
        for path in page_files:
            items = _load_json(path)
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict) or item.get("should_translate") is False:
                    continue
                source_text = str(item.get("source_text") or "")
                match = pattern.search(source_text)
                if match is None:
                    continue
                translated = str(item.get("translated_text") or "")
                if target in translated:
                    consistent += 1
                    continue
                start = max(0, match.start() - _EXCERPT_RADIUS)
                end = min(len(source_text), match.end() + _EXCERPT_RADIUS)
                page_idx = item.get("page_idx")
                affected.append(
                    {
                        "item_id": item.get("item_id"),
                        "page": page_idx + 1 if isinstance(page_idx, int) else None,
                        "source_excerpt": source_text[start:end],
                        "translated_text": translated[:_TEXT_PREVIEW_CHARS],
                    }
                )
        return affected, consistent, len(page_files)

    def _page_files(self) -> list[Path] | None:
        translated = self._translated_dir()
        if not translated.is_dir():
            return None
        manifest = _load_json(translated / "translation-manifest.json")
        names: list[str] = []
        pages = manifest.get("pages") if isinstance(manifest, dict) else None
        if isinstance(pages, list):
            for page in pages:
                name = str(page.get("path") or "") if isinstance(page, dict) else ""
                if _SAFE_PAGE_FILE.fullmatch(name):
                    names.append(name)
        if not names:
            names = sorted(path.name for path in translated.glob("page-*.json"))
        files = []
        for name in names:
            path = translated / name
            if path.is_file() and not path.is_symlink():
                files.append(path)
        return files

    # ------------------------------------------------------------------ helpers

    def _read(self, argv_head: tuple[str, ...]) -> CliResult:
        area, action, *rest = argv_head
        return self._call(
            "translation.read",
            (area, action, "--job-id", self._job_id, *rest),
            None,
        )


def _failure(detail: dict[str, Any]) -> dict[str, Any]:
    return {
        "exit_code": 1,
        "stdout": "",
        "stderr": json.dumps(detail, ensure_ascii=False, indent=2) + "\n",
    }


def _backend_detail(result: CliResult) -> dict[str, Any]:
    detail: dict[str, Any] = {"http_status": result.http_status}
    if result.message:
        detail["backend_message"] = result.message
    response = result.response
    if isinstance(response, dict):
        error = response.get("error")
        if isinstance(error, dict) and error.get("details") is not None:
            detail["details"] = error.get("details")
        elif response.get("data") is not None:
            detail["details"] = response.get("data")
    return detail


def _revise_failure_message(result: CliResult) -> str:
    if result.http_status == 422:
        return (
            "写回被拒：新译文没通过校验（常见原因：占位符或 $…$ 公式和原来不一致、"
            "残留英文、译文为空）。看 details 里的 issues，改好再提交。"
        )
    if result.http_status == 409:
        return "写回冲突：这块刚被别处改过或任务正在跑。先 show 看最新译文再改。"
    if result.http_status == 404:
        return "找不到这个块：item_id 写错了，或这本书没有可写回的译文。"
    return "写回失败"


def _source_status(result: CliResult) -> str:
    if result.ok:
        return "ok"
    if result.http_status == 404:
        return "missing"
    return f"error: {result.message or result.http_status}"


def _report(result: CliResult) -> dict[str, Any] | None:
    if not result.ok or not isinstance(result.data, dict):
        return None
    report = result.data.get("report")
    return report if isinstance(report, dict) else None


def _qa_issues(report: dict[str, Any]) -> list[dict[str, Any]]:
    issues = []
    for violation in report.get("violations") or []:
        if not isinstance(violation, dict):
            continue
        location = violation.get("location") if isinstance(violation.get("location"), dict) else {}
        item_ids = [str(value) for value in location.get("item_ids") or [] if value]
        item_id = str(location.get("item_id") or "") or (item_ids[0] if item_ids else "")
        issue: dict[str, Any] = {
            "origin": "qa",
            "id": violation.get("id"),
            "item_id": item_id or None,
            "page": _page_number(location.get("page_number")),
            "severity": violation.get("severity"),
            "category": f"{violation.get('check')}/{violation.get('type')}",
            "message": violation.get("message"),
        }
        if len(item_ids) > 1:
            issue["item_ids"] = item_ids
        evidence = violation.get("evidence")
        if evidence:
            issue["evidence"] = _compact(evidence)
        issues.append(issue)
    return issues


def _refine_issues(report: dict[str, Any], *, include_qa_origin: bool) -> list[dict[str, Any]]:
    review = report.get("review") if isinstance(report.get("review"), dict) else {}
    fixes: dict[str, dict[str, Any]] = {}
    for fix in report.get("fixes") or []:
        if isinstance(fix, dict) and fix.get("item_id"):
            fixes[str(fix["item_id"])] = {
                "status": fix.get("status"),
                "reject_reason": fix.get("reject_reason") or None,
                "revision_id": fix.get("revision_id") or None,
            }
    issues = []
    for finding in review.get("findings") or []:
        if not isinstance(finding, dict):
            continue
        origin = str(finding.get("origin") or "review")
        if origin == "qa" and not include_qa_origin:
            continue  # QA 报告里已经有了，别重复列
        item_id = str(finding.get("item_id") or "")
        issue = {
            "origin": "refine_" + origin,
            "item_id": item_id or None,
            "page": _page_number(finding.get("page_number")),
            "severity": finding.get("severity"),
            "category": finding.get("category"),
            "target_span": finding.get("target_span"),
            "source_span": finding.get("source_span"),
            "explanation": finding.get("explanation"),
            "suggestion": finding.get("suggestion"),
        }
        if item_id in fixes:
            issue["fix"] = fixes[item_id]
        issues.append(issue)
    return issues


def _refine_summary(report: dict[str, Any]) -> dict[str, Any]:
    fixes = [fix for fix in report.get("fixes") or [] if isinstance(fix, dict)]
    review = report.get("review") if isinstance(report.get("review"), dict) else {}
    findings = [item for item in review.get("findings") or [] if isinstance(item, dict)]
    summary: dict[str, Any] = {
        key: report.get(key)
        for key in ("mode", "trigger", "scope", "stopped_reason", "generated_at")
        if report.get(key) is not None
    }
    summary["findings"] = len(findings)
    # 没审完时停在哪：从 next_page 接着精修（retry-stage refine 的 start_page）。
    for key in ("unreviewed_item_count", "next_page"):
        if review.get(key) is not None:
            summary[key] = review.get(key)
    summary["fixes_by_status"] = dict(Counter(str(fix.get("status")) for fix in fixes))
    rejected = Counter(
        str(fix.get("reject_reason")) for fix in fixes if fix.get("status") == "rejected"
    )
    if rejected:
        summary["rejected_by_reason"] = dict(rejected)
    return summary


def _revision_view(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "revision_id": record.get("revision_id"),
        "ts": record.get("ts"),
        "source": record.get("source"),
        "reason": record.get("reason"),
        "previous_text": record.get("previous_text"),
        "new_text": record.get("new_text"),
    }


def _entry_input(entry: dict[str, Any]) -> dict[str, str]:
    return {
        field: str(entry.get(field) or "")
        for field in ("source", "target", "note", "level", "match_mode", "context")
    }


def _term_pattern(source: str) -> re.Pattern[str]:
    escaped = re.escape(source)
    if source.isascii():
        # 英文术语按词边界、忽略大小写匹配：「ion」不该命中「ionization」。
        return re.compile(rf"(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])", re.IGNORECASE)
    return re.compile(escaped)


def _in_pages(page: Any, pages: Any) -> bool:
    if not pages:
        return True
    if not isinstance(page, int):
        return False
    start, end = pages
    return start <= page <= end


def _page_number(value: Any) -> int | None:
    """1-based 页码；文档级问题的 page_number 是 0，按「没有页码」处理。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, str) and value.isdigit():
        value = int(value)
    if isinstance(value, int) and value > 0:
        return value
    return None


def _compact(value: Any, limit: int = 300) -> Any:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(encoded) <= limit:
        return value
    return encoded[:limit] + "…"


def _load_json(path: Path) -> Any:
    try:
        if path.is_symlink() or not path.is_file():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


__all__ = [
    "CliCall",
    "CliResult",
    "JOB_GLOSSARY_NAME_PREFIX",
    "TranslationCommandRunner",
]
