"""翻译编辑部（refine=editorial）：渲染前，在已提交译文之上多轮修订。

和精修（review_and_fix）的区别：

- 精修：挑错 → 一律定点修改 → 一轮结束。
- 编辑部：规则修正 → 审校挑错 + 质检出问题 → 审校和术语表冲突的意见按术语表裁决（不改）→
  主编（模型）逐块在规则框里分流：局部改 / 整块重写 / 不改 / 交给人 → 修订执行，每次改动走
  和精修同一套验收（写回预演、占位符与公式校验、质检不新增问题、长度预算）→ 没解决的进下一轮，
  最多 ``MAX_ROUNDS`` 轮，剩下的列入「待人看」。每件事写进台账
  ``artifacts/editorial/ledger.jsonl``；中断后续跑时复用台账里已经开出的问题单，不重复审校。

读取、挑错、局部改与验收复用 ``workflow/refine.py``；报告沿用精修报告的格式（mode=editorial），
另加 ``editorial`` 一节。设计见 ``docs/core/translation/editorial-agents.md``。
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from retainpdf_pipeline.translate.services.editorial import chief as chief_rules
from retainpdf_pipeline.translate.services.editorial import rewrite as rewrite_rules
from retainpdf_pipeline.translate.services.editorial import terms as term_rules
from retainpdf_pipeline.translate.services.editorial.chief import Attempts
from retainpdf_pipeline.translate.services.editorial.chief import Decision
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_DECISION
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_DISPUTE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_ISSUE_ESCALATE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_ISSUE_OPEN
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_ISSUE_RESOLVE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_REVIEW_DONE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_RUN_END
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_RUN_START
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_TERM_DECISION
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_TERM_REQUEST
from retainpdf_pipeline.translate.services.editorial.ledger import LEDGER_RELATIVE_PATH
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_CHIEF
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_HUMAN
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_QA
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_REVIEWER
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_REVISER
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_RULES
from retainpdf_pipeline.translate.services.editorial.ledger import ROLE_TERMS
from retainpdf_pipeline.translate.services.editorial.ledger import EditorialLedger
from retainpdf_pipeline.translate.services.editorial.ledger import find_resumable_run
from retainpdf_pipeline.translate.services.editorial.ledger import ledger_path
from retainpdf_pipeline.translate.services.editorial.ledger import new_run_id
from retainpdf_pipeline.translate.services.editorial.ledger import read_ledger
from retainpdf_pipeline.translate.services.preparation.term_base import TERM_BASE_FILE_NAME
from retainpdf_pipeline.translate.services.preparation.term_base import load_term_base
from retainpdf_pipeline.translate.services.preparation.term_base import write_json_atomic
from retainpdf_pipeline.translate.services.quality.qa.report import build_translation_qa_for_job
from retainpdf_pipeline.translate.services.quality.qa.report import load_translated_pages_for_qa
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem
from retainpdf_pipeline.translate.services.refine import fix as fix_rules
from retainpdf_pipeline.translate.services.refine import report as report_rules
from retainpdf_pipeline.translate.services.refine import review as review_rules
from retainpdf_pipeline.translate.services.refine.config import RefineConfig
from retainpdf_pipeline.translate.services.refine.llm import ChatFn
from retainpdf_pipeline.translate.services.refine.llm import RefineBudgetExceeded
from retainpdf_pipeline.translate.services.refine.llm import RefineChat
from retainpdf_pipeline.translate.services.refine.llm import TokenLedger
from retainpdf_pipeline.translate.services.refine.llm import provider_chat_fn
from retainpdf_pipeline.translate.workflow import refine as base

ESCALATE_LIMIT = "达到修改次数上限，仍未解决"
ESCALATE_ROUNDS = f"{chief_rules.MAX_ROUNDS} 轮后仍未解决"
ESCALATE_RECHECK = "改过之后审校复核仍发现问题"
ESCALATE_BUDGET = "token 预算用完，没来得及处理"
ESCALATE_NO_MODEL = "修订模型不可用"
RULING_KEEP_TERM_BASE = "keep_term_base"
# 审校、主编、修订各自同时发出的请求数。写回仍逐块串行。取得保守：小服务商（智谱默认并发 5）
# 也扛得住，又比一批接一批快数倍。
EDITORIAL_WORKERS = 4
# 主编要多想一步：翻译设置是「自动」时，主编用中等思考深度；用户明确设了就照设置。
CHIEF_DEFAULT_THINKING = "medium"


# ---- 准备 ----------------------------------------------------------------------


def _chats(
    cfg: RefineConfig,
    ledger: TokenLedger,
    *,
    chat_fn: ChatFn | None,
    fix_chat_fn: ChatFn | None,
    report: dict[str, Any],
) -> dict[str, RefineChat | None]:
    reviewer_info, fixer_info, reviewer_key, translation_key = base._connections(cfg)
    chief_info = dict(reviewer_info)
    if chief_info.get("thinking") in ("", "auto"):
        chief_info["thinking"] = CHIEF_DEFAULT_THINKING
    rewriter_info = dict(fixer_info)
    report["models"] = {"reviewer": reviewer_info, "fixer": fixer_info}
    report["editorial"]["models"] = {"chief": chief_info, "rewriter": rewriter_info, "terminologist": dict(fixer_info)}
    if chat_fn is not None:
        fixer = fix_chat_fn or chat_fn
        return {
            "review": RefineChat(chat_fn, ledger),
            "chief": RefineChat(chat_fn, ledger),
            "terms": RefineChat(chat_fn, ledger),
            "fix": RefineChat(fixer, ledger),
            "rewrite": RefineChat(fixer, ledger),
        }

    def connect(info: dict[str, Any], key: str) -> RefineChat | None:
        if not key or not info.get("model"):
            return None
        return RefineChat(
            provider_chat_fn(
                model=info["model"],
                base_url=info["base_url"],
                api_key=key,
                protocol=info.get("api_protocol", ""),
                thinking=info.get("thinking", ""),
            ),
            ledger,
        )

    return {
        "review": connect(reviewer_info, reviewer_key),
        "chief": connect(chief_info, reviewer_key),
        "fix": connect(fixer_info, translation_key),
        "rewrite": connect(rewriter_info, translation_key),
        # 术语专员和译前准备时一样用翻译模型。
        "terms": connect(fixer_info, translation_key),
    }


def _term_review_summary(translations_dir: Path) -> dict[str, Any] | None:
    payload = load_term_base(translations_dir / TERM_BASE_FILE_NAME) or {}
    review = payload.get("review")
    return dict(review) if isinstance(review, dict) else None


def _finding_from_row(row: dict[str, Any]) -> review_rules.Finding:
    return review_rules.Finding(
        finding_id=str(row.get("finding_id", "")),
        item_id=str(row.get("item_id", "")),
        page_number=int(row.get("page_number", 0) or 0),
        category=str(row.get("category", "")),
        severity=str(row.get("severity", "")),
        target_span=str(row.get("target_span", "")),
        source_span=str(row.get("source_span", "")),
        explanation=str(row.get("explanation", "")),
        suggestion=str(row.get("suggestion", "")),
        origin=str(row.get("origin", "")),
        qa=row.get("qa") if isinstance(row.get("qa"), dict) else None,
    )


def _finding_number(row: dict[str, Any]) -> int:
    suffix = str(row.get("finding_id", "")).rsplit("-", 1)[-1]
    return int(suffix) if suffix.isdigit() else 0


def _open_issue(ledger: EditorialLedger, finding: review_rules.Finding, *, actor: str) -> None:
    ledger.append(KIND_ISSUE_OPEN, actor=actor, to=ROLE_CHIEF, refs=[finding.item_id], finding=finding.as_dict())


# ---- 争议：审校意见和术语表冲突 -------------------------------------------------


def _term_disputes(
    findings: list[review_rules.Finding],
    items_by_id: dict[str, QaItem],
    locked_terms,
) -> tuple[list[review_rules.Finding], list[dict[str, Any]]]:
    """审校要改掉术语表锁定的译法（比如把「位力定理」改成「维里定理」）：挑出来交给术语专员裁决。

    判定：圈出的片段里有锁定译法，而建议的写法里这个译法变少了（被拿掉或换掉）。只是片段里
    恰好带着锁定译法、建议照样保留它的（比如「量子力学期维里定理」→「量子力学位力定理」），
    是在维护术语表，不算争议。裁决见 ``_settle_term_disputes``。
    """
    kept: list[review_rules.Finding] = []
    disputes: list[dict[str, Any]] = []
    for finding in findings:
        item = items_by_id.get(finding.item_id)
        conflict = None
        if finding.origin == review_rules.ORIGIN_REVIEW and finding.category == "terminology" and item is not None:
            for term in review_rules.locked_terms_for(locked_terms, item.protected_source):
                target = term.get("target", "")
                if (
                    target
                    and target != term.get("source")
                    and target in finding.target_span
                    and finding.suggestion.count(target) < finding.target_span.count(target)
                ):
                    conflict = term
                    break
        if conflict is None:
            kept.append(finding)
            continue
        disputes.append(
            {
                "item_id": finding.item_id,
                "finding_id": finding.finding_id,
                "term_source": conflict["source"],
                "term_target": conflict["target"],
                "ruling": RULING_KEEP_TERM_BASE,
                "explanation": finding.explanation[:300],
            }
        )
    return kept, disputes


def _unify_by_rule(
    item: QaItem,
    after: str,
    *,
    target_span: str,
    term_source: str,
    suggestion: str,
    explanation: str,
    ledger: EditorialLedger,
    pages: dict[int, list[dict]],
    context: dict[str, Any],
    next_id: base._Ids,
) -> tuple[review_rules.Finding, dict[str, Any]]:
    """术语统一的规则改写（不调模型），走和修订同一套验收；写进台账。"""
    finding = review_rules.Finding(
        finding_id=next_id(),
        item_id=item.item_id,
        page_number=item.page_number,
        category="terminology",
        severity="minor",
        target_span=target_span,
        source_span=term_source,
        explanation=explanation,
        suggestion=suggestion,
        origin=review_rules.ORIGIN_RULE,
    )
    record = base._fix_record(item, [finding])
    record["origin"] = "rule"
    record["action"] = chief_rules.ACTION_PATCH
    record["note"] = "按术语表统一（规则修正，未调用模型）"
    no_growth = item.item_id in context["fit_constrained"]
    budget = len(item.protected_translated) if no_growth else max(
        len(after), fix_rules.length_budget(item, [finding], no_growth=False)
    )
    record = base.accept_candidate(
        record=record, item=item, findings=[finding], after=after, budget=budget,
        no_growth=no_growth, pages=pages, context=context,
    )
    _open_issue(ledger, finding, actor=ROLE_TERMS)
    ledger.append(
        KIND_ISSUE_RESOLVE, actor=ROLE_RULES, refs=[item.item_id], action="rule",
        status=record["status"], reason=record["reject_reason"], revision_id=record.get("revision_id"), round=0,
    )
    return finding, record


def _patrol_terms(
    qa_payload: dict[str, Any],
    *,
    chat: RefineChat | None,
    ledger: EditorialLedger,
    pages: dict[int, list[dict]],
    context: dict[str, Any],
    section: dict[str, Any],
    next_id: base._Ids,
    progress: base._Progress,
    errors: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], list[review_rules.Finding], bool]:
    """术语巡检：同一个英文词有的地方保留、有的地方译掉了，由术语专员定全书怎么统一。

    译成中文：进术语表（锁定），保留英文的地方按规则换成中文。保留原文：进术语表（保留原文），
    译掉的地方交给后面的质检 → 主编 → 修订（质检按新术语表会报出来）。两种都合理：不动。
    返回（规则修正记录, 问题单, 术语表是否变了）。
    """
    all_items, items_by_id = base._items_by_id(pages)
    requests = term_rules.build_patrol_requests(qa_payload, items_by_id)
    if not requests or chat is None:
        return [], [], False
    size = term_rules.TERM_PATROL_BATCH_SIZE
    batches = [requests[i : i + size] for i in range(0, len(requests), size)]
    progress.total += len(batches)
    responses = base.request_batches(
        chat,
        "terms",
        [term_rules.build_term_patrol_messages(batch) for batch in batches],
        response_format=term_rules.TERM_REQUEST_RESPONSE_FORMAT,
        workers=EDITORIAL_WORKERS,
        on_done=lambda done, total: progress.batch("terms", f"编辑部：术语专员巡检 {done}/{total} 批", done, total),
    )
    proposals: dict[str, dict[str, str]] = {}
    for index, (content, failure) in enumerate(responses, start=1):
        try:
            if failure is not None:
                raise failure
            proposals.update(term_rules.parse_term_request_response(content or ""))
        except Exception as exc:  # noqa: BLE001 - 这批不统一
            errors.append({"phase": "terms", "batch": f"patrol.{index}", "message": f"{type(exc).__name__}: {exc}"[:500]})
    translations_dir: Path = context["translations_dir"]
    term_base_path = translations_dir / TERM_BASE_FILE_NAME
    term_base = load_term_base(term_base_path) or {"schema": "term_base_v1", "schema_version": 1, "terms": []}
    rows: list[dict[str, Any]] = []
    changed = False
    for request in requests:
        decision, target, reason = term_rules.settle_patrol(
            request, proposals.get(request["term_source"].casefold()), target_lang="zh-CN"
        )
        ledger.append(
            KIND_TERM_DECISION, actor=ROLE_TERMS, to=ROLE_CHIEF, refs=[], patrol=True,
            term_source=request["term_source"], ruling=decision, target=target, reason=reason,
        )
        if decision == term_rules.PATROL_TRANSLATE:
            changed |= term_rules.add_term(
                term_base, request["term_source"], target, treatment="lock", reason=reason, run_id=ledger.run_id
            )
        elif decision == term_rules.PATROL_KEEP_ORIGINAL:
            changed |= term_rules.add_term(
                term_base, request["term_source"], "", treatment="keep_original", reason=reason, run_id=ledger.run_id
            )
        rows.append({"source": request["term_source"], "decision": decision, "target": target, "reason": reason, "applied_item_ids": []})
    if changed:
        write_json_atomic(term_base_path, term_base)
    fixes: list[dict[str, Any]] = []
    findings: list[review_rules.Finding] = []
    for row in rows:
        if row["decision"] != term_rules.PATROL_TRANSLATE:
            continue
        for item_id in [item.item_id for item in all_items if item.checked]:
            _all, current = base._items_by_id(pages)
            item = current[item_id]
            if row["source"].casefold() not in item.protected_source.casefold():
                continue
            after = term_rules.english_rewrite(item.protected_translated, row["source"], row["target"])
            if after is None:
                continue
            finding, record = _unify_by_rule(
                item,
                after,
                target_span=row["source"],
                term_source=row["source"],
                suggestion=row["target"],
                explanation=f"术语专员定「{row['source']}」全书统一译为「{row['target']}」，按规则统一",
                ledger=ledger,
                pages=pages,
                context=context,
                next_id=next_id,
            )
            findings.append(finding)
            fixes.append(record)
            if record["status"] == fix_rules.FIX_APPLIED:
                row["applied_item_ids"].append(item.item_id)
    section["term_patrol"] = rows
    return fixes, findings, changed


def _settle_term_disputes(
    disputes: list[dict[str, Any]],
    findings_by_id: dict[str, review_rules.Finding],
    items_by_id: dict[str, QaItem],
    *,
    chat: RefineChat | None,
    ledger: EditorialLedger,
    pages: dict[int, list[dict]],
    context: dict[str, Any],
    section: dict[str, Any],
    next_id: base._Ids,
    progress: base._Progress,
    errors: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], list[review_rules.Finding], dict[str, str]]:
    """术语改动申请：术语专员逐条裁决；改了就改术语表并按规则统一全书。

    返回（规则统一的修改记录, 对应的问题单, 交给人的块 → 原因）。争议的 ruling 原地填好。
    """
    translations_dir: Path = context["translations_dir"]
    term_base_path = translations_dir / TERM_BASE_FILE_NAME
    term_base = load_term_base(term_base_path)
    requests = term_rules.build_requests(disputes, findings_by_id, items_by_id, term_base)
    rulings: dict[str, tuple[str, str, str]] = {}
    size = term_rules.TERM_REQUEST_BATCH_SIZE
    batches = [requests[i : i + size] for i in range(0, len(requests), size)]
    for request in requests:
        ledger.append(
            KIND_TERM_REQUEST, actor=ROLE_REVIEWER, to=ROLE_TERMS, refs=request["item_ids"],
            **term_rules.request_payload(request),
        )
    proposals: dict[str, dict[str, str]] = {}
    if chat is not None and batches:
        progress.total += len(batches)
        responses = base.request_batches(
            chat,
            "terms",
            [term_rules.build_term_request_messages(batch) for batch in batches],
            response_format=term_rules.TERM_REQUEST_RESPONSE_FORMAT,
            workers=EDITORIAL_WORKERS,
            on_done=lambda done, total: progress.batch("terms", f"编辑部：术语专员裁决改动申请 {done}/{total} 批", done, total),
        )
        for index, (content, failure) in enumerate(responses, start=1):
            try:
                if failure is not None:
                    raise failure
                proposals.update(term_rules.parse_term_request_response(content or ""))
            except Exception as exc:  # noqa: BLE001 - 这批申请交给人
                errors.append({"phase": "terms", "batch": str(index), "message": f"{type(exc).__name__}: {exc}"[:500]})
    target_lang = "zh-CN"
    changes: list[dict[str, str]] = []
    for request in requests:
        key = request["term_source"].casefold()
        if chat is None:
            ruling, target, reason = term_rules.RULING_ESCALATE, "", "术语专员模型不可用"
        else:
            ruling, target, reason = term_rules.settle(request, proposals.get(key), target_lang=target_lang)
        rulings[key] = (ruling, target, reason)
        ledger.append(
            KIND_TERM_DECISION, actor=ROLE_TERMS, to=ROLE_CHIEF, refs=request["item_ids"],
            term_source=request["term_source"], ruling=ruling, target=target, reason=reason,
        )
        if ruling == term_rules.RULING_CHANGE and term_base is not None:
            for change in term_rules.apply_change(
                term_base, request["term_source"], target, reason=reason, run_id=ledger.run_id
            ):
                changes.append({**change, "reason": reason if change["source"] == request["term_source"] else "随短词条一致化"})
    escalations: dict[str, str] = {}
    for dispute in disputes:
        ruling, target, reason = rulings.get(
            dispute["term_source"].casefold(), (term_rules.RULING_KEEP, "", "用户术语表或不可改的条目，维持")
        )
        dispute["ruling"] = ruling
        if target:
            dispute["new_target"] = target
        if reason:
            dispute["reason"] = reason
        if ruling == term_rules.RULING_ESCALATE:
            escalations.setdefault(
                dispute["item_id"],
                f"术语有争议，需要人定：{dispute['term_source']}（现译「{dispute['term_target']}」）",
            )
        ledger.append(KIND_DISPUTE, actor=ROLE_REVIEWER, to=ROLE_TERMS, refs=[dispute["item_id"]], **dispute)
    fixes: list[dict[str, Any]] = []
    findings: list[review_rules.Finding] = []
    if not changes:
        return fixes, findings, escalations
    write_json_atomic(term_base_path, term_base)
    rows: list[dict[str, Any]] = []
    for change in changes:
        applied: list[str] = []
        all_items, current = base._items_by_id(pages)
        for item_id in [item.item_id for item in all_items if item.checked]:
            _all, current = base._items_by_id(pages)
            item = current[item_id]
            after = term_rules.rule_rewrite(item.protected_source, item.protected_translated, change)
            if after is None:
                continue
            finding, record = _unify_by_rule(
                item,
                after,
                target_span=change["from"],
                term_source=change["source"],
                suggestion=change["to"],
                explanation=f"术语表把「{change['source']}」改为「{change['to']}」，按规则统一（原「{change['from']}」）",
                ledger=ledger,
                pages=pages,
                context=context,
                next_id=next_id,
            )
            findings.append(finding)
            fixes.append(record)
            if record["status"] == fix_rules.FIX_APPLIED:
                applied.append(item.item_id)
        rows.append({**change, "applied_item_ids": applied})
    section["term_changes"] = rows
    return fixes, findings, escalations


def _recheck(
    chat: RefineChat | None,
    item_ids: list[str],
    *,
    pages: dict[int, list[dict]],
    locked_terms,
    style_notes: str,
    next_id: base._Ids,
    progress: base._Progress,
    errors: list[dict[str, str]],
    round_no: int,
    ledger: EditorialLedger,
    recheck: dict[str, Any],
) -> tuple[list[review_rules.Finding], bool]:
    """改过的块交回审校复核。只要要修的问题（critical / major）；和术语表冲突的意见丢掉（本轮已裁决过）。"""
    if chat is None or not item_ids:
        return [], False
    all_items, items_by_id = base._items_by_id(pages)
    candidates = [items_by_id[item_id] for item_id in item_ids if item_id in items_by_id]
    stats = review_rules.ReviewStats(candidate_item_count=len(candidates))
    reviewed: set[str] = set()
    progress.transition("recheck", f"编辑部：审校复核第 {round_no} 轮改过的 {len(candidates)} 块", {"round": round_no})
    findings, stopped = base._run_review(
        chat=chat,
        candidates=candidates,
        all_items=all_items,
        locked_terms=locked_terms,
        style_notes=style_notes,
        qa_flags={},
        stats=stats,
        next_id=next_id,
        progress=progress,
        errors=errors,
        reviewed_ids=reviewed,
        workers=EDITORIAL_WORKERS,
    )
    findings, _disputes = _term_disputes(findings, items_by_id, locked_terms)
    findings = [finding for finding in findings if finding.fixable]
    recheck["item_ids"].update(reviewed)
    recheck["findings"].extend(findings)
    for finding in findings:
        ledger.append(
            KIND_ISSUE_OPEN, actor=ROLE_REVIEWER, to=ROLE_CHIEF, refs=[finding.item_id],
            finding=finding.as_dict(), recheck_round=round_no,
        )
    return findings, stopped == report_rules.STOP_MAX_TOKENS


# ---- 主编分流 ------------------------------------------------------------------


def _triage(
    chat: RefineChat | None,
    open_items: dict[str, list[review_rules.Finding]],
    attempts: dict[str, Attempts],
    items_by_id: dict[str, QaItem],
    *,
    progress: base._Progress,
    errors: list[dict[str, str]],
    round_no: int,
    workers: int = 1,
) -> tuple[list[Decision], bool]:
    """返回（每块的决定, 预算是否用完）。各批并发问主编，结果按批的顺序收。"""
    frames: dict[str, tuple[list[str], str]] = {}
    to_ask: list[dict[str, Any]] = []
    for item_id, findings in open_items.items():
        allowed, default = chief_rules.allowed_actions(findings, attempts[item_id])
        frames[item_id] = (allowed, default)
        if len(allowed) > 1 and item_id in items_by_id:
            to_ask.append(
                chief_rules.chief_item_payload(
                    items_by_id[item_id], findings, attempts[item_id], allowed=allowed, default=default
                )
            )
    proposals: dict[str, dict[str, str]] = {}
    fallback: dict[str, str] = {}
    budget_hit = False
    size = chief_rules.CHIEF_BATCH_SIZE
    batches = [to_ask[i : i + size] for i in range(0, len(to_ask), size)]
    progress.total += len(batches)
    if chat is None:
        fallback.update({entry["item_id"]: "主编模型不可用，按规则默认处理" for entry in to_ask})
        responses: list[tuple[str | None, BaseException | None]] = []
    else:
        responses = base.request_batches(
            chat,
            "chief",
            [chief_rules.build_chief_messages(batch) for batch in batches],
            response_format=chief_rules.CHIEF_RESPONSE_FORMAT,
            workers=workers,
            on_done=lambda done, total: progress.batch("chief", f"编辑部：主编第 {round_no} 轮分流 {done}/{total} 批", done, total),
        )
    for index, (batch, (content, failure)) in enumerate(zip(batches, responses), start=1):
        ids = [entry["item_id"] for entry in batch]
        if isinstance(failure, RefineBudgetExceeded):
            budget_hit = True
            fallback.update({item_id: "token 预算用完，按规则默认处理" for item_id in ids})
            continue
        try:
            if failure is not None:
                raise failure
            proposals.update(chief_rules.parse_chief_response(content or ""))
        except Exception as exc:  # noqa: BLE001 - 主编这一批失败：这批按规则默认
            errors.append({"phase": "chief", "batch": f"{round_no}.{index}", "message": f"{type(exc).__name__}: {exc}"[:500]})
            fallback.update({item_id: "主编请求失败，按规则默认处理" for item_id in ids})
    decisions = []
    for item_id in open_items:
        allowed, default = frames[item_id]
        if len(allowed) == 1:
            decisions.append(Decision(item_id, default, chief_rules.SOURCE_RULE, "只剩这一个动作可选", ""))
            continue
        decisions.append(
            chief_rules.settle_decision(
                item_id,
                proposals.get(item_id),
                allowed=allowed,
                default=default,
                fallback_reason=fallback.get(item_id, "主编没有给出决定，按规则默认处理"),
            )
        )
    return decisions, budget_hit


# ---- 修订 ----------------------------------------------------------------------


def _revise(
    chat: RefineChat | None,
    phase: str,
    item_ids: list[str],
    batch_size: int,
    build_messages,
    parse_response,
    accept,
    *,
    pages: dict[int, list[dict]],
    progress: base._Progress,
    errors: list[dict[str, str]],
    round_no: int,
    label: str,
    workers: int,
    open_items: dict[str, list[review_rules.Finding]],
) -> tuple[list[dict[str, Any]], bool]:
    """局部改与整块重写共用的骨架：各批请求并发发出，答复按批的顺序逐块验收、写回（写回串行）。

    请求是按发出时的译文组装的；同一批前面的块写回后，续接组的兄弟块可能已经变了——验收时
    按当前页重新取块，对不上的编辑会被拒，和精修一致。
    """
    records: list[dict[str, Any]] = []
    budget_hit = False
    batches = [item_ids[i : i + batch_size] for i in range(0, len(item_ids), batch_size)]
    progress.total += len(batches)
    all_items, items_by_id = base._items_by_id(pages)
    batch_items = [[items_by_id[item_id] for item_id in ids if item_id in items_by_id] for ids in batches]
    if chat is None:
        for items in batch_items:
            records.extend(
                base._mark(base._fix_record(item, open_items[item.item_id]), fix_rules.FIX_SKIPPED, fix_rules.SKIP_LLM_UNAVAILABLE)
                for item in items
            )
        return records, False
    prepared = [build_messages(items, all_items) for items in batch_items]
    responses = base.request_batches(
        chat,
        phase,
        [messages for messages, _extra in prepared],
        response_format={"type": "json_object"},
        workers=workers,
        on_done=lambda done, total: progress.batch(phase, f"编辑部：第 {round_no} 轮{label} {done}/{total} 批", done, total),
    )
    for index, (items, (_messages, extra), (content, failure)) in enumerate(zip(batch_items, prepared, responses), start=1):
        batch_records = [base._fix_record(item, open_items[item.item_id]) for item in items]
        if isinstance(failure, RefineBudgetExceeded):
            budget_hit = True
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_BUDGET) for record in batch_records)
            continue
        try:
            if failure is not None:
                raise failure
            proposals = parse_response(content or "")
        except Exception as exc:  # noqa: BLE001 - 单批失败只记下，这批块保留原译
            errors.append({"phase": phase, "batch": f"{round_no}.{index}", "message": f"{type(exc).__name__}: {exc}"[:500]})
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_LLM_ERROR) for record in batch_records)
            continue
        for record in batch_records:
            _items, current = base._items_by_id(pages)
            item = current[record["item_id"]]
            records.append(accept(record, item, proposals.get(item.item_id), extra))
    return records, budget_hit


def _patch(
    chat: RefineChat | None,
    item_ids: list[str],
    open_items: dict[str, list[review_rules.Finding]],
    notes: dict[str, str],
    *,
    pages: dict[int, list[dict]],
    locked_terms,
    context: dict[str, Any],
    progress: base._Progress,
    errors: list[dict[str, str]],
    round_no: int,
    workers: int = 1,
) -> tuple[list[dict[str, Any]], bool]:
    def build(items: list[QaItem], _all_items) -> tuple[list[dict[str, str]], None]:
        payloads = []
        for item in items:
            no_growth = item.item_id in context["fit_constrained"]
            payload = fix_rules.fix_item_payload(
                item,
                open_items[item.item_id],
                terms=review_rules.locked_terms_for(locked_terms, item.protected_source),
                max_chars=fix_rules.length_budget(item, open_items[item.item_id], no_growth=no_growth),
                may_grow=not no_growth,
            )
            if notes.get(item.item_id):
                payload["note"] = notes[item.item_id]
            payloads.append(payload)
        return fix_rules.build_fix_messages(payloads), None

    def accept(record, item, proposal, _extra):
        return base._try_fix_item(
            record=record, item=item, findings=open_items[item.item_id], proposal=proposal, pages=pages, context=context
        )

    return _revise(
        chat, "fix", item_ids, fix_rules.FIX_BATCH_SIZE, build, fix_rules.parse_fix_response, accept,
        pages=pages, progress=progress, errors=errors, round_no=round_no, label="局部修改",
        workers=workers, open_items=open_items,
    )


def _rewrite(
    chat: RefineChat | None,
    item_ids: list[str],
    open_items: dict[str, list[review_rules.Finding]],
    notes: dict[str, str],
    *,
    pages: dict[int, list[dict]],
    locked_terms,
    style_notes: str,
    context: dict[str, Any],
    progress: base._Progress,
    errors: list[dict[str, str]],
    round_no: int,
    workers: int = 1,
) -> tuple[list[dict[str, Any]], bool]:
    def build(items: list[QaItem], all_items) -> tuple[list[dict[str, str]], dict[str, int]]:
        neighbors = base._neighbors(all_items)
        budgets: dict[str, int] = {}
        payloads = []
        for item in items:
            no_growth = item.item_id in context["fit_constrained"]
            budgets[item.item_id] = rewrite_rules.rewrite_length_budget(item, open_items[item.item_id], no_growth=no_growth)
            before, after = neighbors.get(item.item_id, (None, None))
            payloads.append(
                rewrite_rules.rewrite_item_payload(
                    item,
                    open_items[item.item_id],
                    note=notes.get(item.item_id, ""),
                    terms=review_rules.locked_terms_for(locked_terms, item.protected_source),
                    max_chars=budgets[item.item_id],
                    context_before=before.protected_translated if before else "",
                    context_after=after.protected_translated if after else "",
                )
            )
        return rewrite_rules.build_rewrite_messages(payloads, style_notes=style_notes), budgets

    def accept(record, item, proposal, budgets):
        if proposal is None:
            return base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_NO_EDIT)
        record["note"] = proposal["note"]
        return base.accept_candidate(
            record=record,
            item=item,
            findings=open_items[item.item_id],
            after=proposal["translation"],
            budget=budgets[item.item_id],
            no_growth=item.item_id in context["fit_constrained"],
            pages=pages,
            context=context,
        )

    return _revise(
        chat, "rewrite", item_ids, rewrite_rules.REWRITE_BATCH_SIZE, build, rewrite_rules.parse_rewrite_response, accept,
        pages=pages, progress=progress, errors=errors, round_no=round_no, label="整块重写",
        workers=workers, open_items=open_items,
    )


def _still_open_after_change(
    findings: list[review_rules.Finding],
    qa_payload: dict[str, Any],
    item_id: str,
) -> list[review_rules.Finding]:
    """改过的块：审校的问题算解决了（与精修一致）；质检的问题按改后的质检结果再判一次。"""
    remaining_keys = {
        (str(violation.get("check", "")), str(violation.get("type", "")))
        for violation in qa_payload.get("violations") or []
        if str((violation.get("location") or {}).get("item_id", "")) == item_id
    }
    return [
        finding
        for finding in findings
        if finding.origin == review_rules.ORIGIN_QA
        and finding.qa
        and (str(finding.qa.get("check", "")), str(finding.qa.get("type", ""))) in remaining_keys
    ]


# ---- 主流程 --------------------------------------------------------------------


def _editorial_section(term_review: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "ledger_path": LEDGER_RELATIVE_PATH,
        "run_id": "",
        "resumed": False,
        "rounds": 0,
        "max_rounds": chief_rules.MAX_ROUNDS,
        "decisions": {"total": 0, "by_action": {}, "by_source": {}, "overridden": 0},
        "disputes": [],
        "term_changes": [],
        "term_patrol": [],
        "escalated": [],
        "term_review": term_review,
        "models": {},
    }


def run_editorial(
    job_root: Path,
    translations_dir: Path,
    cfg: RefineConfig,
    report: dict[str, Any],
    *,
    chat_fn: ChatFn | None,
    fix_chat_fn: ChatFn | None,
    progress: base._Progress,
) -> None:
    errors: list[dict[str, str]] = report["errors"]
    report["prompt_versions"].update(
        {
            "chief": chief_rules.CHIEF_PROMPT_VERSION,
            "rewrite": rewrite_rules.REWRITE_PROMPT_VERSION,
            "term_request": term_rules.TERM_REQUEST_PROMPT_VERSION,
            "term_patrol": term_rules.TERM_PATROL_PROMPT_VERSION,
        }
    )
    section = _editorial_section(_term_review_summary(translations_dir))
    report["editorial"] = section
    progress.total = 1
    progress.max_rounds = chief_rules.MAX_ROUNDS
    progress.step("prepare", "编辑部：读取译文与质检结果")
    pages = load_translated_pages_for_qa(translations_dir)
    qa_before = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_before")
    report["qa_before"] = report_rules.qa_summary(qa_before)
    if translations_dir.resolve() != (job_root / "translated").resolve():
        errors.append({"phase": "editorial", "message": "translations_dir is not <job_root>/translated; nothing written"})
        report["qa_after"] = report["qa_before"]
        return
    user_glossary, locked_terms = base._glossary(job_root, translations_dir)
    context = {
        "job_root": job_root,
        "translations_dir": translations_dir,
        "user_glossary": user_glossary,
        "fit_constrained": base._fit_constrained_items(qa_before),
    }
    style_notes = base._style_notes(translations_dir)
    identity = base._translation_identity(translations_dir)
    path = ledger_path(job_root)
    resumable = find_resumable_run(read_ledger(path), identity)
    if resumable is not None:
        ledger = EditorialLedger.resume(path, resumable)
        section["resumed"] = resumable.review_done()
    else:
        ledger = EditorialLedger(path, new_run_id())
        ledger.append(KIND_RUN_START, actor=ROLE_CHIEF, translation=identity, mode=cfg.mode, trigger=cfg.trigger)
    section["run_id"] = ledger.run_id
    tokens = TokenLedger(max_tokens=cfg.max_tokens)
    chats = _chats(cfg, tokens, chat_fn=chat_fn, fix_chat_fn=fix_chat_fn, report=report)
    next_id = base._Ids()
    if resumable is not None:
        # 续跑：新问题单的编号接在台账里已有的后面，不和取回的问题单撞号。
        next_id.value = max(
            [0, *(_finding_number(record.get("finding") or {}) for record in resumable.of_kind(KIND_ISSUE_OPEN))]
        )

    # 1. 规则修正（不花钱；重复跑也只会命中还没修的地方）。
    rule_scope = [item.item_id for item in base._items_by_id(pages)[0] if item.checked and cfg.page_in_scope(item.page_number)]
    rule_findings, rule_fixes = base._run_rule_fixes(
        pages=pages, item_ids=rule_scope, context=context, equation_label=base._equation_label(qa_before), next_id=next_id
    )
    for finding, fix in zip(rule_findings, rule_fixes):
        _open_issue(ledger, finding, actor=ROLE_RULES)
        ledger.append(
            KIND_ISSUE_RESOLVE, actor=ROLE_RULES, refs=[finding.item_id], action="rule",
            status=fix["status"], reason=fix["reject_reason"], revision_id=fix.get("revision_id"), round=0,
        )
    for fix in rule_fixes:
        fix["action"] = chief_rules.ACTION_PATCH
    qa_current = qa_before
    if any(fix["status"] == fix_rules.FIX_APPLIED for fix in rule_fixes):
        qa_current = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_before")

    # 2. 审校挑错（续跑时从台账取回已经开出的问题单）+ 质检。
    all_items, items_by_id = base._items_by_id(pages)
    scoped = [item for item in all_items if item.checked and cfg.page_in_scope(item.page_number)]
    stopped: str | None = None
    candidates = scoped
    if cfg.max_items > 0 and len(scoped) > cfg.max_items:
        candidates = scoped[: cfg.max_items]
        stopped = report_rules.STOP_MAX_ITEMS
    stats = review_rules.ReviewStats(candidate_item_count=len(scoped))
    reviewed_ids: set[str] = set()
    if resumable is not None and resumable.review_done():
        review_findings = [
            _finding_from_row(record["finding"])
            for record in resumable.of_kind(KIND_ISSUE_OPEN)
            if (record.get("finding") or {}).get("origin") == review_rules.ORIGIN_REVIEW
        ]
        done = resumable.of_kind(KIND_REVIEW_DONE)[-1]
        stats.reviewed_item_count = int(done.get("reviewed_item_count", 0) or 0)
        stats.batch_count = int(done.get("batch_count", 0) or 0)
        reviewed_ids = set(done.get("reviewed_item_ids") or [])
    else:
        progress.transition("review", f"编辑部：审校开始挑错（{len(candidates)} 块）", {"candidate_items": len(candidates)})
        review_findings, review_stopped = base._run_review(
            chat=chats["review"],
            candidates=candidates,
            all_items=all_items,
            locked_terms=locked_terms,
            style_notes=style_notes,
            qa_flags=review_rules.qa_flags_by_item(qa_current),
            stats=stats,
            next_id=next_id,
            progress=progress,
            errors=errors,
            reviewed_ids=reviewed_ids,
            workers=EDITORIAL_WORKERS,
        )
        if chats["review"] is None and candidates:
            review_stopped = report_rules.STOP_LLM_UNAVAILABLE
        stopped = review_stopped or stopped
        for finding in review_findings:
            _open_issue(ledger, finding, actor=ROLE_REVIEWER)
        if review_stopped is None:
            ledger.append(
                KIND_REVIEW_DONE,
                actor=ROLE_REVIEWER,
                to=ROLE_CHIEF,
                reviewed_item_count=stats.reviewed_item_count,
                batch_count=stats.batch_count,
                reviewed_item_ids=sorted(reviewed_ids),
            )
    # 3. 争议：审校要改术语表锁定的译法 → 术语专员裁决（维持 / 改表 / 交给人）。要在收质检问题之前：
    #    术语表改了，质检就该按新译法判。
    findings_by_id = {finding.finding_id: finding for finding in review_findings}
    review_findings, disputes = _term_disputes(review_findings, items_by_id, locked_terms)
    term_escalations: dict[str, str] = {}
    term_fixes: list[dict[str, Any]] = []
    term_findings: list[review_rules.Finding] = []
    if disputes:
        term_fixes, term_findings, term_escalations = _settle_term_disputes(
            disputes,
            findings_by_id,
            items_by_id,
            chat=chats["terms"],
            ledger=ledger,
            pages=pages,
            context=context,
            section=section,
            next_id=next_id,
            progress=progress,
            errors=errors,
        )
        if term_fixes or section["term_changes"]:
            user_glossary, locked_terms = base._glossary(job_root, translations_dir)
            context["user_glossary"] = user_glossary
            qa_current = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_before")
            all_items, items_by_id = base._items_by_id(pages)
            candidates = [items_by_id.get(item.item_id, item) for item in candidates]
    section["disputes"] = disputes
    # 4. 术语巡检：全书处理不一致的词由术语专员定怎么统一。
    patrol_fixes, patrol_findings, patrol_changed = _patrol_terms(
        qa_current,
        chat=chats["terms"],
        ledger=ledger,
        pages=pages,
        context=context,
        section=section,
        next_id=next_id,
        progress=progress,
        errors=errors,
    )
    if patrol_fixes or patrol_changed:
        user_glossary, locked_terms = base._glossary(job_root, translations_dir)
        context["user_glossary"] = user_glossary
        qa_current = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_before")
        all_items, items_by_id = base._items_by_id(pages)
        candidates = [items_by_id.get(item.item_id, item) for item in candidates]
    rule_findings = [*rule_findings, *term_findings, *patrol_findings]
    rule_fixes = [*rule_fixes, *term_fixes, *patrol_fixes]
    scoped_ids = {item.item_id: item for item in candidates}
    qa_origin = review_rules.qa_findings(qa_current, items_by_id=scoped_ids, next_id=next_id)
    for finding in qa_origin:
        _open_issue(ledger, finding, actor=ROLE_QA)
    order = {item.item_id: item.order for item in all_items}
    findings = sorted(
        [*rule_findings, *review_findings, *qa_origin],
        key=lambda f: (order.get(f.item_id, 0), f.origin != "review", f.finding_id),
    )
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
            **report_rules.coverage(scoped, reviewed_ids),
        }
    )

    # 5. 多轮：主编分流 → 修订 → 验收 → 审校复核。
    open_items: dict[str, list[review_rules.Finding]] = {}
    for finding in [*review_findings, *qa_origin]:
        if finding.fixable and finding.item_id in items_by_id:
            open_items.setdefault(finding.item_id, []).append(finding)
    attempts: dict[str, Attempts] = {item_id: Attempts() for item_id in open_items}
    if resumable is not None:
        # 上次已经改成功的块不再处理；没成功的尝试计入次数。
        for record in resumable.of_kind(KIND_ISSUE_RESOLVE):
            for item_id in record.get("refs") or []:
                if item_id not in attempts or record.get("action") not in (chief_rules.ACTION_PATCH, chief_rules.ACTION_REWRITE):
                    continue
                if record.get("status") == fix_rules.FIX_APPLIED:
                    open_items.pop(item_id, None)
                else:
                    attempts[item_id].record(record["action"], str(record.get("status", "")), str(record.get("reason", "")))
    fixes: list[dict[str, Any]] = list(rule_fixes)
    decisions_all: list[Decision] = []
    recheck: dict[str, Any] = {"item_ids": set(), "findings": []}
    escalated: dict[str, str] = dict(term_escalations)
    for item_id in term_escalations:
        open_items.pop(item_id, None)
    budget_hit = stopped == report_rules.STOP_MAX_TOKENS
    round_no = 0
    while open_items and round_no < chief_rules.MAX_ROUNDS and not budget_hit:
        round_no += 1
        progress.round = round_no
        _items, items_by_id = base._items_by_id(pages)
        progress.transition("chief", f"编辑部：第 {round_no} 轮，主编分流 {len(open_items)} 块", {"round": round_no})
        decisions, budget_hit = _triage(
            chats["chief"], open_items, attempts, items_by_id, progress=progress, errors=errors, round_no=round_no,
            workers=EDITORIAL_WORKERS,
        )
        decisions_all.extend(decisions)
        notes = {decision.item_id: decision.note for decision in decisions}
        patch_ids, rewrite_ids = [], []
        for decision in decisions:
            ledger.append(KIND_DECISION, actor=ROLE_CHIEF, to=ROLE_REVISER, refs=[decision.item_id], round=round_no, **decision.as_dict())
            if decision.action == chief_rules.ACTION_PATCH:
                patch_ids.append(decision.item_id)
            elif decision.action == chief_rules.ACTION_REWRITE:
                rewrite_ids.append(decision.item_id)
            elif decision.action == chief_rules.ACTION_KEEP:
                ledger.append(KIND_ISSUE_RESOLVE, actor=ROLE_CHIEF, refs=[decision.item_id], action="keep",
                              status="kept", reason=decision.reason, round=round_no)
                open_items.pop(decision.item_id, None)
            else:
                escalated[decision.item_id] = decision.reason or "主编交给人处理"
                open_items.pop(decision.item_id, None)
        records: list[dict[str, Any]] = []
        if patch_ids:
            patched, hit = _patch(
                chats["fix"], patch_ids, open_items, notes, pages=pages, locked_terms=locked_terms,
                context=context, progress=progress, errors=errors, round_no=round_no, workers=EDITORIAL_WORKERS,
            )
            for record in patched:
                record["action"] = chief_rules.ACTION_PATCH
            records.extend(patched)
            budget_hit = budget_hit or hit
        if rewrite_ids:
            rewritten, hit = _rewrite(
                chats["rewrite"], rewrite_ids, open_items, notes, pages=pages, locked_terms=locked_terms,
                style_notes=style_notes, context=context, progress=progress, errors=errors, round_no=round_no,
                workers=EDITORIAL_WORKERS,
            )
            for record in rewritten:
                record["action"] = chief_rules.ACTION_REWRITE
            records.extend(rewritten)
            budget_hit = budget_hit or hit
        applied_ids: set[str] = set()
        for record in records:
            record["round"] = round_no
            attempts[record["item_id"]].record(record["action"], record["status"], record["reject_reason"])
            ledger.append(
                KIND_ISSUE_RESOLVE, actor=ROLE_REVISER, to=ROLE_CHIEF, refs=[record["item_id"]],
                action=record["action"], status=record["status"], reason=record["reject_reason"],
                detail=record["reject_detail"], revision_id=record.get("revision_id"), round=round_no,
            )
            if record["status"] == fix_rules.FIX_APPLIED:
                applied_ids.add(record["item_id"])
        fixes.extend(records)
        if applied_ids:
            qa_now = build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_check")
            for item_id in applied_ids:
                remaining = _still_open_after_change(open_items.get(item_id, []), qa_now, item_id)
                if remaining:
                    open_items[item_id] = remaining
                else:
                    open_items.pop(item_id, None)
            if not budget_hit:
                # 审校复核：改过的块交回审校再看一遍；新发现的问题进下一轮，最后一轮之后的交给人。
                new_findings, recheck_hit = _recheck(
                    chats["review"],
                    sorted(applied_ids, key=lambda item_id: order.get(item_id, 0)),
                    pages=pages,
                    locked_terms=locked_terms,
                    style_notes=style_notes,
                    next_id=next_id,
                    progress=progress,
                    errors=errors,
                    round_no=round_no,
                    ledger=ledger,
                    recheck=recheck,
                )
                budget_hit = budget_hit or recheck_hit
                for finding in new_findings:
                    open_items.setdefault(finding.item_id, []).append(finding)
                    attempts.setdefault(finding.item_id, Attempts())
                    if round_no >= chief_rules.MAX_ROUNDS:
                        escalated.setdefault(finding.item_id, f"{ESCALATE_RECHECK}：{finding.explanation[:80]}")
                if round_no >= chief_rules.MAX_ROUNDS:
                    for finding in new_findings:
                        open_items.pop(finding.item_id, None)
        if budget_hit:
            stopped = report_rules.STOP_MAX_TOKENS
    for item_id in list(open_items):
        if budget_hit:
            reason = ESCALATE_BUDGET
        elif chats["fix"] is None and chats["rewrite"] is None:
            reason = ESCALATE_NO_MODEL
        elif chief_rules.allowed_actions(open_items[item_id], attempts[item_id])[1] == chief_rules.ACTION_ESCALATE:
            reason = ESCALATE_LIMIT
        else:
            reason = ESCALATE_ROUNDS
        escalated[item_id] = reason
    _items, items_by_id = base._items_by_id(pages)
    all_findings_by_item: dict[str, list[review_rules.Finding]] = {}
    for finding in [*findings, *recheck["findings"]]:
        all_findings_by_item.setdefault(finding.item_id, []).append(finding)
    escalated_rows = []
    for item_id, reason in escalated.items():
        item_findings = all_findings_by_item.get(item_id, [])
        row = {
            "item_id": item_id,
            "page_number": items_by_id[item_id].page_number if item_id in items_by_id else 0,
            "reason": reason,
            "finding_ids": [finding.finding_id for finding in item_findings],
            "categories": sorted({finding.category for finding in item_findings}),
            "attempts": list(attempts.get(item_id, Attempts()).history),
        }
        escalated_rows.append(row)
        ledger.append(KIND_ISSUE_ESCALATE, actor=ROLE_CHIEF, to=ROLE_HUMAN, refs=[item_id], reason=reason)
    escalated_rows.sort(key=lambda row: (order.get(row["item_id"], 0), row["item_id"]))
    section["escalated"] = escalated_rows
    section["rounds"] = round_no
    section["decisions"] = {
        "total": len(decisions_all),
        "by_action": dict(sorted(Counter(decision.action for decision in decisions_all).items())),
        "by_source": dict(sorted(Counter(decision.source for decision in decisions_all).items())),
        "overridden": sum(1 for decision in decisions_all if decision.overridden),
    }

    if recheck["findings"]:
        finding_rows = [*finding_rows, *(finding.as_dict() for finding in recheck["findings"])]
        report["review"]["findings"] = finding_rows
        report["review"]["summary"] = report_rules.findings_summary(finding_rows)
    section["recheck"] = {
        "item_count": len(recheck["item_ids"]),
        "finding_count": len(recheck["findings"]),
    }

    # 6. 报告。
    report["fixes"] = fixes
    report["fix_summary"] = report_rules.fixes_summary(fixes)
    report["token_usage"] = tokens.as_dict()
    report["stopped_reason"] = stopped
    changed = {fix["item_id"] for fix in fixes if fix["status"] == fix_rules.FIX_APPLIED}
    qa_after = (
        build_translation_qa_for_job(job_root, translations_dir=translations_dir, mode="refine_after") if changed else qa_before
    )
    report["qa_after"] = report_rules.qa_summary(qa_after)
    report["qa_delta"] = report_rules.qa_delta(qa_before, qa_after, item_ids=changed)
    report["translation"]["after"] = base._translation_identity(translations_dir)
    if stopped is not None:
        report["status"] = report_rules.STATUS_STOPPED
    ledger.append(
        KIND_RUN_END,
        actor=ROLE_CHIEF,
        status=report["status"],
        applied=len(changed),
        escalated=len(escalated_rows),
        disputes=len(disputes),
        rounds=round_no,
        tokens=report["token_usage"]["total_tokens"],
    )


__all__ = ["run_editorial"]
