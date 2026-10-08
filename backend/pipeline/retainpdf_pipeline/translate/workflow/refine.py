"""译后精修编排：挑错 → 定点修改 → 精修报告。在渲染之前、已提交译文之上运行。

入口 ``run_refine_for_render``（经 translate.public 暴露，runtime 层在 render-only 之前调用）：
- mode=off：直接返回 None，不读不写任何东西（与没有精修时完全一致）；
- trigger=auto 且本次翻译已经有精修报告（续跑到渲染阶段）：跳过，不重复花钱；
- review_only：只挑错、只写报告，不动任何译文；
- review_and_fix：只修 critical / major，模型给编辑操作，由确定性检查决定收不收；
  收下的经第一期 ``revise_translation_item`` 写回（source=refine），原译留在修订历史里。
任何异常都不往外抛：记进报告（status=failed），渲染照常进行。
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable, Mapping

from retainpdf_pipeline.foundation.shared.stage_specs import resolve_credential_ref
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.translate.core.payload.manifest import load_translation_manifest
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_FILE_NAME
from retainpdf_pipeline.translate.services.preparation.style_guide import render_style_guidance
from retainpdf_pipeline.translate.services.preparation.term_base import TERM_BASE_FILE_NAME
from retainpdf_pipeline.translate.services.preparation.term_base import load_json_object
from retainpdf_pipeline.translate.services.preparation.term_base import load_term_base
from retainpdf_pipeline.translate.services.preparation.term_base import term_base_glossary_entries
from retainpdf_pipeline.translate.services.quality.qa.fit import CHECK_LAYOUT_FIT
from retainpdf_pipeline.translate.services.quality.qa.report import build_translation_qa
from retainpdf_pipeline.translate.services.quality.qa.report import build_translation_qa_for_job
from retainpdf_pipeline.translate.services.quality.qa.report import load_job_glossary_entries
from retainpdf_pipeline.translate.services.quality.qa.report import load_translated_pages_for_qa
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem
from retainpdf_pipeline.translate.services.quality.qa.units import build_qa_items
from retainpdf_pipeline.translate.services.refine import edits as edit_ops
from retainpdf_pipeline.translate.services.refine import fix as fix_rules
from retainpdf_pipeline.translate.services.refine import report as report_rules
from retainpdf_pipeline.translate.services.refine import review as review_rules
from retainpdf_pipeline.translate.services.refine.config import REFINE_TRIGGER_AUTO
from retainpdf_pipeline.translate.services.refine.config import RefineConfig
from retainpdf_pipeline.translate.services.refine.config import refine_config_from_mapping
from retainpdf_pipeline.translate.services.refine.llm import ChatFn
from retainpdf_pipeline.translate.services.refine.llm import RefineBudgetExceeded
from retainpdf_pipeline.translate.services.refine.llm import RefineChat
from retainpdf_pipeline.translate.services.refine.llm import TokenLedger
from retainpdf_pipeline.translate.services.refine.llm import provider_chat_fn
from retainpdf_pipeline.translate.workflow.checkpoint.contract import translation_checkpoint_path
from retainpdf_pipeline.translate.workflow.execution import resolve_reviewer_connection
from retainpdf_pipeline.translate.workflow.revision import RevisionOutcome
from retainpdf_pipeline.translate.workflow.revision import RevisionRequest
from retainpdf_pipeline.translate.workflow.revision import preview_translation_revision
from retainpdf_pipeline.translate.workflow.revision import revise_translation_item


REFINE_SUBSTAGE = "refining"
REFINE_EVENT_STAGE = "rendering"
REVISION_SOURCE_REFINE = "refine"


# ---- 进度事件 ------------------------------------------------------------------


class _Progress:
    """渲染阶段的子步骤 refining：stage=rendering、substage=refining、progress_unit=step。

    current 单调递增（事件层会按 (user_stage, substage, unit) 做单调钳制），total 在挑错结束、
    知道要修多少块之后会变大。
    """

    def __init__(self, mode: str) -> None:
        self.mode = mode
        self.current = 0
        self.total = 0

    def _payload(self, phase: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "user_stage": "render",
            "progress_unit": "step",
            "refine_phase": phase,
            "refine_mode": self.mode,
            **(extra or {}),
        }

    def transition(self, phase: str, message: str, extra: dict[str, Any] | None = None) -> None:
        emit_stage_transition(
            stage=REFINE_EVENT_STAGE,
            substage=REFINE_SUBSTAGE,
            message=message,
            progress_current=self.current,
            progress_total=self.total,
            payload=self._payload(phase, extra),
        )

    def step(self, phase: str, message: str, extra: dict[str, Any] | None = None) -> None:
        self.current += 1
        self.total = max(self.total, self.current)
        emit_stage_progress(
            stage=REFINE_EVENT_STAGE,
            substage=REFINE_SUBSTAGE,
            message=message,
            progress_current=self.current,
            progress_total=self.total,
            payload=self._payload(phase, extra),
        )


# ---- 读取材料 ------------------------------------------------------------------


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


def _translation_identity(translations_dir: Path) -> dict[str, Any]:
    checkpoint = _read_json(translation_checkpoint_path(translations_dir)) or {}
    return {
        "attempt_id": str(checkpoint.get("attempt_id", "") or ""),
        "fingerprint": str(checkpoint.get("fingerprint", "") or ""),
        "generation": checkpoint.get("generation") if isinstance(checkpoint.get("generation"), int) else None,
    }


def _already_refined(report_path: Path, translations_dir: Path) -> bool:
    """trigger=auto 时：本次翻译已经精修过就跳过。

    比约定（「报告存在就跳过」）多一道保险：报告里记的翻译身份（attempt_id + fingerprint）
    和当前 checkpoint 对不上——说明译文是重新翻出来的——就不算精修过。
    """
    if not report_path.is_file():
        return False
    report = _read_json(report_path)
    if report is None:
        return True
    recorded = (report.get("translation") or {}) if isinstance(report.get("translation"), dict) else {}
    current = _translation_identity(translations_dir)
    for key in ("attempt_id", "fingerprint"):
        if recorded.get(key) and current.get(key) and recorded.get(key) != current.get(key):
            return False
    return True


def _glossary(job_root: Path, translations_dir: Path) -> tuple[list[dict], list]:
    user_entries = load_job_glossary_entries(job_root)
    term_base = load_term_base(translations_dir / TERM_BASE_FILE_NAME)
    locked = normalize_glossary_entries([*user_entries, *term_base_glossary_entries(term_base)])
    return user_entries, locked


def _style_notes(translations_dir: Path) -> str:
    payload = load_json_object(translations_dir / STYLE_GUIDE_FILE_NAME)
    return render_style_guidance(payload) if payload else ""


def _fit_constrained_items(qa_payload: dict[str, Any]) -> set[str]:
    """上一次渲染里已经溢出或进入应急档的块：精修不许让它们变长。"""
    constrained: set[str] = set()
    for violation in qa_payload.get("violations") or []:
        if violation.get("check") != CHECK_LAYOUT_FIT:
            continue
        location = violation.get("location") or {}
        constrained.update(str(item_id) for item_id in location.get("item_ids") or [] if item_id)
    return constrained


def _items_by_id(pages: dict[int, list[dict]]) -> tuple[list[QaItem], dict[str, QaItem]]:
    items = build_qa_items(pages)
    return items, {item.item_id: item for item in items}


# ---- 模型连接 ------------------------------------------------------------------


def _connections(cfg: RefineConfig) -> tuple[dict[str, Any], dict[str, Any], str, str]:
    translation_key = resolve_credential_ref(cfg.credential_ref)
    reviewer_key = resolve_credential_ref(cfg.reviewer_credential_ref)
    reviewer = resolve_reviewer_connection(
        SimpleNamespace(
            model=cfg.model,
            base_url=cfg.base_url,
            api_key=translation_key,
            reviewer_model=cfg.reviewer_model,
            reviewer_base_url=cfg.reviewer_base_url,
            reviewer_api_key=reviewer_key,
        )
    )
    reviewer_info = {"model": reviewer.model, "base_url": reviewer.base_url, "inherited": reviewer.inherited}
    fixer_info = {"model": cfg.model, "base_url": cfg.base_url, "inherited": False}
    return reviewer_info, fixer_info, reviewer.api_key, translation_key


# ---- 挑错 ----------------------------------------------------------------------


class _Ids:
    def __init__(self) -> None:
        self.value = 0

    def __call__(self) -> str:
        self.value += 1
        return f"rf-{self.value:05d}"


def _neighbors(items: list[QaItem]) -> dict[str, tuple[QaItem | None, QaItem | None]]:
    translated = [item for item in items if item.checked]
    result: dict[str, tuple[QaItem | None, QaItem | None]] = {}
    for index, item in enumerate(translated):
        before = translated[index - 1] if index > 0 else None
        after = translated[index + 1] if index + 1 < len(translated) else None
        result[item.item_id] = (before, after)
    return result


def _run_review(
    *,
    chat: RefineChat | None,
    candidates: list[QaItem],
    all_items: list[QaItem],
    locked_terms,
    style_notes: str,
    qa_flags: dict[str, list[dict[str, Any]]],
    stats: review_rules.ReviewStats,
    next_id: _Ids,
    progress: _Progress,
    errors: list[dict[str, str]],
) -> tuple[list[review_rules.Finding], str | None]:
    if chat is None or not candidates:
        return [], None
    neighbors = _neighbors(all_items)
    payloads = []
    for item in candidates:
        before, after = neighbors.get(item.item_id, (None, None))
        payloads.append(
            review_rules.review_item_payload(
                item,
                before=before,
                after=after,
                terms=review_rules.locked_terms_for(locked_terms, item.protected_source),
                qa_flags=qa_flags.get(item.item_id, []),
            )
        )
    batches = review_rules.batch_payloads(payloads)
    progress.total += len(batches)
    items_by_id = {item.item_id: item for item in candidates}
    seen: set[tuple[str, str, str]] = set()
    findings: list[review_rules.Finding] = []
    stopped: str | None = None
    for index, batch in enumerate(batches, start=1):
        messages = review_rules.build_review_messages(batch, style_notes=style_notes)
        try:
            content = chat.request("review", messages, response_format=review_rules.REVIEW_RESPONSE_FORMAT)
        except RefineBudgetExceeded:
            stopped = report_rules.STOP_MAX_TOKENS
            break
        except Exception as exc:  # noqa: BLE001 - 单批失败只记下，继续下一批
            stats.batch_count += 1
            stats.failed_batch_count += 1
            errors.append({"phase": "review", "batch": str(index), "message": f"{type(exc).__name__}: {exc}"[:500]})
            progress.step("review", f"精修：挑错第 {index}/{len(batches)} 批失败")
            continue
        stats.batch_count += 1
        stats.reviewed_item_count += len(batch)
        try:
            raw = review_rules.parse_review_findings(content)
        except (ValueError, TypeError) as exc:
            stats.failed_batch_count += 1
            errors.append({"phase": "review", "batch": str(index), "message": f"unparseable response: {exc}"[:500]})
            raw = []
        findings.extend(
            review_rules.accept_review_findings(
                raw, items_by_id=items_by_id, stats=stats, next_id=next_id, seen=seen
            )
        )
        progress.step(
            "review",
            f"精修：挑错 {index}/{len(batches)} 批，已发现 {len(findings)} 处",
            {"findings": len(findings)},
        )
    if stopped is None and stats.batch_count and stats.failed_batch_count == stats.batch_count:
        stopped = report_rules.STOP_LLM_ERROR
    return findings, stopped


# ---- 定点修改 ------------------------------------------------------------------


def _fix_record(item: QaItem, findings: list[review_rules.Finding]) -> dict[str, Any]:
    return {
        "item_id": item.item_id,
        "page_number": item.page_number,
        "finding_ids": [finding.finding_id for finding in findings],
        "categories": sorted({finding.category for finding in findings}),
        "status": fix_rules.FIX_SKIPPED,
        "reject_reason": "",
        "reject_detail": "",
        "before": item.protected_translated,
        "after": None,
        "edits": [],
        "note": "",
        "revision_id": None,
        "length_before": len(item.protected_translated),
        "length_after": None,
        "length_budget": None,
    }


def _mark(record: dict[str, Any], status: str, reason: str = "", detail: str = "") -> dict[str, Any]:
    record["status"] = status
    record["reject_reason"] = reason
    record["reject_detail"] = detail[:500]
    return record


def _qa_for_pages(pages: dict[int, list[dict]], page_indexes: list[int], context: dict[str, Any]) -> dict[str, Any]:
    return build_translation_qa(
        {idx: pages[idx] for idx in page_indexes if idx in pages},
        glossary_entries=context["user_glossary"],
        term_base_path=context["translations_dir"] / TERM_BASE_FILE_NAME,
        style_guide_path=context["translations_dir"] / STYLE_GUIDE_FILE_NAME,
        fit_report_path=None,
        mode="refine_check",
    )


def _reload_pages(translations_dir: Path, pages: dict[int, list[dict]], page_indexes: list[int]) -> None:
    paths = load_translation_manifest(translations_dir)
    for idx in page_indexes:
        if idx in paths:
            pages[idx] = json.loads(paths[idx].read_text(encoding="utf-8"))


def _try_fix_item(
    *,
    record: dict[str, Any],
    item: QaItem,
    findings: list[review_rules.Finding],
    proposal: dict[str, Any] | None,
    pages: dict[int, list[dict]],
    context: dict[str, Any],
) -> dict[str, Any]:
    if proposal is None or not proposal.get("edits"):
        return _mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_NO_EDIT)
    record["note"] = proposal.get("note", "")
    before = item.protected_translated
    record["before"] = before
    record["length_before"] = len(before)
    try:
        after, applied = edit_ops.apply_edits(before, proposal["edits"])
    except edit_ops.EditRejected as exc:
        record["edits"] = [edit for edit in proposal["edits"] if isinstance(edit, dict)]
        return _mark(record, fix_rules.FIX_REJECTED, exc.reason, exc.detail)
    record["edits"] = [edit.as_dict() for edit in applied]
    record["after"] = after
    record["length_after"] = len(after)
    # 4. 编辑后与编辑前不能相同；也不能退回成原文。
    if after.strip() == before.strip():
        return _mark(record, fix_rules.FIX_REJECTED, fix_rules.REJECT_UNCHANGED, "edits produced no change")
    if after.strip() == item.protected_source.strip():
        return _mark(record, fix_rules.FIX_REJECTED, fix_rules.REJECT_SAME_AS_SOURCE, "edited text equals the source")
    # 3. 长度预算。
    no_growth = item.item_id in context["fit_constrained"]
    budget = fix_rules.length_budget(item, findings, no_growth=no_growth)
    record["length_budget"] = budget
    if len(after) > budget:
        reason = fix_rules.REJECT_FIT_NO_GROWTH if no_growth else fix_rules.REJECT_LENGTH_BUDGET
        return _mark(record, fix_rules.FIX_REJECTED, reason, f"{len(after)} chars > budget {budget}")
    # 1. 与写回时同一套校验（预演，不落盘）。
    try:
        preview = preview_translation_revision(context["job_root"], pages, item.item_id, after)
    except RevisionOutcome as exc:
        if exc.reason == "item_not_translatable":
            return _mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_NOT_TRANSLATABLE, exc.message)
        reason = fix_rules.REJECT_VALIDATION if exc.outcome == "rejected" else fix_rules.REJECT_REVISION_CONFLICT
        return _mark(record, fix_rules.FIX_REJECTED, reason, exc.message)
    # 2. 该块（含续接组成员）的确定性 QA 不能新增违规。
    unit_ids = {item.item_id, *(str(member.get("item_id", "")) for _idx, member in preview.members)}
    changed = preview.changed_pages
    before_keys = fix_rules.violation_keys(_qa_for_pages(pages, changed, context), unit_ids)
    after_keys = fix_rules.violation_keys(_qa_for_pages(preview.revised_payloads, changed, context), unit_ids)
    introduced = fix_rules.new_violations(before_keys, after_keys)
    if introduced:
        detail = ", ".join(f"{row['check']}/{row['type']}" for row in introduced)
        return _mark(record, fix_rules.FIX_REJECTED, fix_rules.REJECT_QA_REGRESSION, detail)
    # 全部通过：经第一期写回链路落盘（原译留在 revisions.v1.jsonl）。
    try:
        result = revise_translation_item(
            context["job_root"],
            RevisionRequest(
                item_id=item.item_id,
                translated_text=after,
                source=REVISION_SOURCE_REFINE,
                reason=fix_rules.revision_reason(findings, record["note"]),
            ),
        )
    except RevisionOutcome as exc:
        reason = fix_rules.REJECT_VALIDATION if exc.outcome == "rejected" else fix_rules.REJECT_REVISION_CONFLICT
        return _mark(record, fix_rules.FIX_REJECTED, reason, exc.message)
    if not result.get("changed"):
        return _mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_REVISION_UNCHANGED)
    record["revision_id"] = (result.get("revision") or {}).get("revision_id")
    record["generation"] = result.get("generation")
    _reload_pages(context["translations_dir"], pages, changed)
    return _mark(record, fix_rules.FIX_APPLIED)


def _run_fixes(
    *,
    chat: RefineChat | None,
    findings: list[review_rules.Finding],
    pages: dict[int, list[dict]],
    locked_terms,
    context: dict[str, Any],
    progress: _Progress,
    errors: list[dict[str, str]],
    budget_exhausted: bool,
) -> tuple[list[dict[str, Any]], str | None]:
    by_item: dict[str, list[review_rules.Finding]] = {}
    for finding in findings:
        if finding.fixable:
            by_item.setdefault(finding.item_id, []).append(finding)
    if not by_item:
        return [], None
    _items, items_by_id = _items_by_id(pages)
    order = [item_id for item_id in by_item if item_id in items_by_id]
    batches = [order[start : start + fix_rules.FIX_BATCH_SIZE] for start in range(0, len(order), fix_rules.FIX_BATCH_SIZE)]
    progress.total += len(batches)
    records: list[dict[str, Any]] = []
    stopped: str | None = report_rules.STOP_MAX_TOKENS if budget_exhausted else None
    for index, batch_ids in enumerate(batches, start=1):
        _items, items_by_id = _items_by_id(pages)
        batch_items = [items_by_id[item_id] for item_id in batch_ids]
        batch_records = [_fix_record(item, by_item[item.item_id]) for item in batch_items]
        if stopped is not None or chat is None:
            reason = fix_rules.SKIP_BUDGET if stopped == report_rules.STOP_MAX_TOKENS else fix_rules.SKIP_LLM_UNAVAILABLE
            records.extend(_mark(record, fix_rules.FIX_SKIPPED, reason) for record in batch_records)
            continue
        payloads = []
        for item in batch_items:
            no_growth = item.item_id in context["fit_constrained"]
            payloads.append(
                fix_rules.fix_item_payload(
                    item,
                    by_item[item.item_id],
                    terms=review_rules.locked_terms_for(locked_terms, item.protected_source),
                    max_chars=fix_rules.length_budget(item, by_item[item.item_id], no_growth=no_growth),
                    may_grow=not no_growth,
                )
            )
        try:
            content = chat.request("fix", fix_rules.build_fix_messages(payloads), response_format=fix_rules.FIX_RESPONSE_FORMAT)
            proposals = fix_rules.parse_fix_response(content)
        except RefineBudgetExceeded:
            stopped = report_rules.STOP_MAX_TOKENS
            records.extend(_mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_BUDGET) for record in batch_records)
            continue
        except Exception as exc:  # noqa: BLE001 - 单批失败只记下，这批块保留原译
            errors.append({"phase": "fix", "batch": str(index), "message": f"{type(exc).__name__}: {exc}"[:500]})
            records.extend(_mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_LLM_ERROR) for record in batch_records)
            progress.step("fix", f"精修：修改第 {index}/{len(batches)} 批失败")
            continue
        for record in batch_records:
            # 同一批里前面的块写回后，续接组的兄弟块可能已经变了：按当前页重新取一次。
            _items, items_by_id = _items_by_id(pages)
            item = items_by_id[record["item_id"]]
            records.append(
                _try_fix_item(
                    record=record,
                    item=item,
                    findings=by_item[item.item_id],
                    proposal=proposals.get(item.item_id),
                    pages=pages,
                    context=context,
                )
            )
        applied = sum(1 for record in records if record["status"] == fix_rules.FIX_APPLIED)
        progress.step("fix", f"精修：修改 {index}/{len(batches)} 批，已采纳 {applied} 处", {"applied": applied})
    return records, stopped


# ---- 入口 ----------------------------------------------------------------------


def _base_report(cfg: RefineConfig, translations_dir: Path) -> dict[str, Any]:
    return {
        "schema": report_rules.REFINE_REPORT_SCHEMA,
        "schema_version": report_rules.REFINE_REPORT_SCHEMA_VERSION,
        "generated_at": report_rules.now_iso(),
        "status": report_rules.STATUS_COMPLETED,
        "mode": cfg.mode,
        "trigger": cfg.trigger,
        "scope": cfg.scope_payload(),
        "models": {},
        "limits": {
            "max_items": cfg.max_items,
            "max_tokens": cfg.max_tokens,
            "review_batch_size": review_rules.REVIEW_BATCH_SIZE,
            "fix_batch_size": fix_rules.FIX_BATCH_SIZE,
            "max_fix_rounds": fix_rules.MAX_FIX_ROUNDS,
            "length_budget_ratio": fix_rules.LENGTH_BUDGET_RATIO,
            "fix_severities": list(review_rules.FIXABLE_SEVERITIES),
        },
        "stopped_reason": None,
        "prompt_versions": {"review": review_rules.REVIEW_PROMPT_VERSION, "fix": fix_rules.FIX_PROMPT_VERSION},
        "translation": {"before": _translation_identity(translations_dir), "after": None},
        "review": {
            "candidate_item_count": 0,
            "reviewed_item_count": 0,
            "batch_count": 0,
            "failed_batch_count": 0,
            "raw_finding_count": 0,
            "discarded": {},
            "summary": report_rules.findings_summary([]),
            "findings": [],
        },
        "fixes": [],
        "fix_summary": report_rules.fixes_summary([]),
        "token_usage": TokenLedger().as_dict(),
        "qa_before": None,
        "qa_after": None,
        "qa_delta": {"resolved": [], "introduced": []},
        "errors": [],
        "elapsed_ms": 0,
    }


def _refine(
    job_root: Path,
    translations_dir: Path,
    cfg: RefineConfig,
    report: dict[str, Any],
    *,
    chat_fn: ChatFn | None,
    fix_chat_fn: ChatFn | None,
    progress: _Progress,
) -> None:
    errors: list[dict[str, str]] = report["errors"]
    progress.total = 1
    progress.step("prepare", "精修：读取译文与 QA")
    pages = load_translated_pages_for_qa(translations_dir)
    qa_before = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_before")
    report["qa_before"] = report_rules.qa_summary(qa_before)
    all_items, items_by_id = _items_by_id(pages)
    scoped = [item for item in all_items if item.checked and cfg.page_in_scope(item.page_number)]
    stopped: str | None = None
    candidates = scoped
    if cfg.max_items > 0 and len(scoped) > cfg.max_items:
        candidates = scoped[: cfg.max_items]
        stopped = report_rules.STOP_MAX_ITEMS
    user_glossary, locked_terms = _glossary(job_root, translations_dir)
    scoped_ids = {item.item_id: item for item in candidates}
    next_id = _Ids()

    reviewer_info, fixer_info, reviewer_key, translation_key = _connections(cfg)
    report["models"] = {"reviewer": reviewer_info, "fixer": fixer_info}
    ledger = TokenLedger(max_tokens=cfg.max_tokens)
    review_chat: RefineChat | None = None
    fixer_chat: RefineChat | None = None
    if chat_fn is not None:
        review_chat = RefineChat(chat_fn, ledger)
        fixer_chat = RefineChat(fix_chat_fn or chat_fn, ledger)
    else:
        if reviewer_key and reviewer_info["model"]:
            review_chat = RefineChat(
                provider_chat_fn(model=reviewer_info["model"], base_url=reviewer_info["base_url"], api_key=reviewer_key),
                ledger,
            )
        if translation_key and cfg.model:
            fixer_chat = RefineChat(
                provider_chat_fn(model=cfg.model, base_url=cfg.base_url, api_key=translation_key), ledger
            )
        if review_chat is None:
            errors.append({"phase": "review", "message": "reviewer model or credential unavailable; LLM review skipped"})
    if cfg.applies_fixes and fixer_chat is None and chat_fn is None:
        errors.append({"phase": "fix", "message": "translation model or credential unavailable; fixes skipped"})

    stats = review_rules.ReviewStats(candidate_item_count=len(scoped))
    progress.transition("review", f"精修：开始挑错（{len(candidates)} 块）", {"candidate_items": len(candidates)})
    review_findings, review_stopped = _run_review(
        chat=review_chat,
        candidates=candidates,
        all_items=all_items,
        locked_terms=locked_terms,
        style_notes=_style_notes(translations_dir),
        qa_flags=review_rules.qa_flags_by_item(qa_before),
        stats=stats,
        next_id=next_id,
        progress=progress,
        errors=errors,
    )
    if review_chat is None and candidates:
        review_stopped = report_rules.STOP_LLM_UNAVAILABLE
    stopped = review_stopped or stopped
    qa_origin = review_rules.qa_findings(qa_before, items_by_id=scoped_ids, next_id=next_id)
    order = {item.item_id: item.order for item in all_items}
    findings = sorted([*review_findings, *qa_origin], key=lambda f: (order.get(f.item_id, 0), f.origin != "review", f.finding_id))
    finding_rows = [finding.as_dict() for finding in findings]
    report["review"].update(
        {
            "candidate_item_count": stats.candidate_item_count,
            "reviewed_item_count": stats.reviewed_item_count,
            "batch_count": stats.batch_count,
            "failed_batch_count": stats.failed_batch_count,
            "raw_finding_count": stats.raw_finding_count,
            "discarded": dict(sorted(stats.discarded.items())),
            "summary": report_rules.findings_summary(finding_rows),
            "findings": finding_rows,
        }
    )

    fixes: list[dict[str, Any]] = []
    if cfg.applies_fixes:
        same_dir = translations_dir.resolve() == (job_root / "translated").resolve()
        if not same_dir:
            errors.append({"phase": "fix", "message": "translations_dir is not <job_root>/translated; fixes skipped"})
        else:
            context = {
                "job_root": job_root,
                "translations_dir": translations_dir,
                "user_glossary": user_glossary,
                "fit_constrained": _fit_constrained_items(qa_before),
            }
            progress.transition("fix", "精修：开始定点修改")
            fixes, fix_stopped = _run_fixes(
                chat=fixer_chat,
                findings=findings,
                pages=pages,
                locked_terms=locked_terms,
                context=context,
                progress=progress,
                errors=errors,
                budget_exhausted=stopped == report_rules.STOP_MAX_TOKENS,
            )
            stopped = stopped or fix_stopped
    report["fixes"] = fixes
    report["fix_summary"] = report_rules.fixes_summary(fixes)
    report["token_usage"] = ledger.as_dict()
    report["stopped_reason"] = stopped

    applied_ids = {fix["item_id"] for fix in fixes if fix["status"] == fix_rules.FIX_APPLIED}
    if applied_ids:
        qa_after = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_after")
    else:
        qa_after = qa_before
    report["qa_after"] = report_rules.qa_summary(qa_after)
    report["qa_delta"] = report_rules.qa_delta(qa_before, qa_after, item_ids=applied_ids)
    report["translation"]["after"] = _translation_identity(translations_dir)
    if stopped is not None:
        report["status"] = report_rules.STATUS_STOPPED


def run_refine_for_render(
    job_root: Path,
    translations_dir: Path,
    config: Mapping[str, Any] | RefineConfig | None,
    *,
    chat_fn: ChatFn | None = None,
    fix_chat_fn: ChatFn | None = None,
) -> dict[str, Any] | None:
    """渲染前精修。返回写出的报告；mode=off 或已精修过（trigger=auto）返回 None。绝不抛异常。"""

    cfg = config if isinstance(config, RefineConfig) else refine_config_from_mapping(config)
    if not cfg.enabled:
        return None
    started = time.perf_counter()
    report: dict[str, Any] | None = None
    try:
        job_root = Path(job_root)
        translations_dir = Path(translations_dir)
        report_path = report_rules.refine_report_path(job_root)
        if cfg.trigger == REFINE_TRIGGER_AUTO and _already_refined(report_path, translations_dir):
            print(f"refine: skipped, already refined for this translation -> {report_path}", flush=True)
            return None
        progress = _Progress(cfg.mode)
        report = _base_report(cfg, translations_dir)
        progress.transition("start", f"开始精修译文（{cfg.mode}）")
        _refine(job_root, translations_dir, cfg, report, chat_fn=chat_fn, fix_chat_fn=fix_chat_fn, progress=progress)
    except Exception as exc:  # noqa: BLE001 - 精修失败不能拖垮渲染
        print(f"refine: failed {type(exc).__name__}: {exc}", flush=True)
        if report is None:
            try:
                report = _base_report(cfg, Path(translations_dir))
            except Exception:  # noqa: BLE001
                return None
        report["status"] = report_rules.STATUS_FAILED
        report["stopped_reason"] = report_rules.STOP_ERROR
        report["errors"].append({"phase": "refine", "message": f"{type(exc).__name__}: {exc}"[:500]})
    report["elapsed_ms"] = int(round((time.perf_counter() - started) * 1000))
    report["generated_at"] = report_rules.now_iso()
    try:
        path = report_rules.write_refine_report(Path(job_root), report)
    except Exception as exc:  # noqa: BLE001
        print(f"refine: report write failed {type(exc).__name__}: {exc}", flush=True)
        return report
    review = report["review"]["summary"]
    fixes = report["fix_summary"]
    message = (
        f"精修完成：发现 {review['finding_count']} 处，采纳 {fixes['applied']}，"
        f"拒绝 {fixes['rejected']}，跳过 {fixes['skipped']}"
    )
    try:
        emit_stage_transition(
            stage=REFINE_EVENT_STAGE,
            substage=REFINE_SUBSTAGE,
            message=message,
            payload={
                "user_stage": "render",
                "progress_unit": "step",
                "refine_phase": "done",
                "refine_mode": cfg.mode,
                "refine_status": report["status"],
                "stopped_reason": report["stopped_reason"],
                "report_path": str(path),
            },
        )
    except Exception:  # noqa: BLE001 - 事件只是观测
        pass
    print(
        f"refine: status={report['status']} findings={review['finding_count']} applied={fixes['applied']} "
        f"rejected={fixes['rejected']} skipped={fixes['skipped']} tokens={report['token_usage']['total_tokens']} -> {path}",
        flush=True,
    )
    return report


__all__ = ["REFINE_SUBSTAGE", "run_refine_for_render"]
