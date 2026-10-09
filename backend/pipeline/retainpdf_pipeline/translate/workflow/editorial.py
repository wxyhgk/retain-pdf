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
from retainpdf_pipeline.translate.services.editorial.chief import Attempts
from retainpdf_pipeline.translate.services.editorial.chief import Decision
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_DECISION
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_DISPUTE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_ISSUE_ESCALATE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_ISSUE_OPEN
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_ISSUE_RESOLVE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_REVIEW_DONE
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_RULING
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_RUN_END
from retainpdf_pipeline.translate.services.editorial.ledger import KIND_RUN_START
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
ESCALATE_BUDGET = "token 预算用完，没来得及处理"
ESCALATE_NO_MODEL = "修订模型不可用"
RULING_KEEP_TERM_BASE = "keep_term_base"
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
    report["editorial"]["models"] = {"chief": chief_info, "rewriter": rewriter_info}
    if chat_fn is not None:
        fixer = fix_chat_fn or chat_fn
        return {
            "review": RefineChat(chat_fn, ledger),
            "chief": RefineChat(chat_fn, ledger),
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
    """审校要改掉术语表锁定的译法（比如把「位力定理」改成「维里定理」）：按术语表裁决，不改。

    判定：圈出的片段里有锁定译法，而建议的写法里这个译法变少了（被拿掉或换掉）。只是片段里
    恰好带着锁定译法、建议照样保留它的（比如「量子力学期维里定理」→「量子力学位力定理」），
    是在维护术语表，不算争议。第一期由规则裁决；审校认为术语表错了，应该向术语专员提改动申请
    （第二期）。
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
) -> tuple[list[Decision], bool]:
    """返回（每块的决定, 预算是否用完）。"""
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
    batches = [to_ask[i : i + chief_rules.CHIEF_BATCH_SIZE] for i in range(0, len(to_ask), chief_rules.CHIEF_BATCH_SIZE)]
    progress.total += len(batches)
    for index, batch in enumerate(batches, start=1):
        ids = [entry["item_id"] for entry in batch]
        if chat is None or budget_hit:
            reason = "token 预算用完，按规则默认处理" if budget_hit else "主编模型不可用，按规则默认处理"
            fallback.update({item_id: reason for item_id in ids})
            continue
        try:
            content = chat.request(
                "chief", chief_rules.build_chief_messages(batch), response_format=chief_rules.CHIEF_RESPONSE_FORMAT
            )
            proposals.update(chief_rules.parse_chief_response(content))
        except RefineBudgetExceeded:
            budget_hit = True
            fallback.update({item_id: "token 预算用完，按规则默认处理" for item_id in ids})
        except Exception as exc:  # noqa: BLE001 - 主编这一批失败：这批按规则默认
            errors.append({"phase": "chief", "batch": f"{round_no}.{index}", "message": f"{type(exc).__name__}: {exc}"[:500]})
            fallback.update({item_id: "主编请求失败，按规则默认处理" for item_id in ids})
        progress.step("chief", f"编辑部：主编第 {round_no} 轮分流 {index}/{len(batches)} 批")
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
) -> tuple[list[dict[str, Any]], bool]:
    records: list[dict[str, Any]] = []
    budget_hit = False
    batches = [item_ids[i : i + fix_rules.FIX_BATCH_SIZE] for i in range(0, len(item_ids), fix_rules.FIX_BATCH_SIZE)]
    progress.total += len(batches)
    for index, batch_ids in enumerate(batches, start=1):
        _items, items_by_id = base._items_by_id(pages)
        batch_items = [items_by_id[item_id] for item_id in batch_ids if item_id in items_by_id]
        batch_records = [base._fix_record(item, open_items[item.item_id]) for item in batch_items]
        if chat is None or budget_hit:
            reason = fix_rules.SKIP_BUDGET if budget_hit else fix_rules.SKIP_LLM_UNAVAILABLE
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, reason) for record in batch_records)
            continue
        payloads = []
        for item in batch_items:
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
        try:
            content = chat.request("fix", fix_rules.build_fix_messages(payloads), response_format=fix_rules.FIX_RESPONSE_FORMAT)
            proposals = fix_rules.parse_fix_response(content)
        except RefineBudgetExceeded:
            budget_hit = True
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_BUDGET) for record in batch_records)
            continue
        except Exception as exc:  # noqa: BLE001 - 单批失败只记下，这批块保留原译
            errors.append({"phase": "fix", "batch": f"{round_no}.{index}", "message": f"{type(exc).__name__}: {exc}"[:500]})
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_LLM_ERROR) for record in batch_records)
            continue
        for record in batch_records:
            _items, items_by_id = base._items_by_id(pages)
            item = items_by_id[record["item_id"]]
            records.append(
                base._try_fix_item(
                    record=record,
                    item=item,
                    findings=open_items[item.item_id],
                    proposal=proposals.get(item.item_id),
                    pages=pages,
                    context=context,
                )
            )
        progress.step("patch", f"编辑部：第 {round_no} 轮局部修改 {index}/{len(batches)} 批")
    return records, budget_hit


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
) -> tuple[list[dict[str, Any]], bool]:
    records: list[dict[str, Any]] = []
    budget_hit = False
    size = rewrite_rules.REWRITE_BATCH_SIZE
    batches = [item_ids[i : i + size] for i in range(0, len(item_ids), size)]
    progress.total += len(batches)
    for index, batch_ids in enumerate(batches, start=1):
        all_items, items_by_id = base._items_by_id(pages)
        neighbors = base._neighbors(all_items)
        batch_items = [items_by_id[item_id] for item_id in batch_ids if item_id in items_by_id]
        batch_records = [base._fix_record(item, open_items[item.item_id]) for item in batch_items]
        if chat is None or budget_hit:
            reason = fix_rules.SKIP_BUDGET if budget_hit else fix_rules.SKIP_LLM_UNAVAILABLE
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, reason) for record in batch_records)
            continue
        budgets: dict[str, int] = {}
        payloads = []
        for item in batch_items:
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
        try:
            content = chat.request(
                "rewrite",
                rewrite_rules.build_rewrite_messages(payloads, style_notes=style_notes),
                response_format=rewrite_rules.REWRITE_RESPONSE_FORMAT,
            )
            proposals = rewrite_rules.parse_rewrite_response(content)
        except RefineBudgetExceeded:
            budget_hit = True
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_BUDGET) for record in batch_records)
            continue
        except Exception as exc:  # noqa: BLE001
            errors.append({"phase": "rewrite", "batch": f"{round_no}.{index}", "message": f"{type(exc).__name__}: {exc}"[:500]})
            records.extend(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_LLM_ERROR) for record in batch_records)
            continue
        for record in batch_records:
            _items, items_by_id = base._items_by_id(pages)
            item = items_by_id[record["item_id"]]
            proposal = proposals.get(item.item_id)
            if proposal is None:
                records.append(base._mark(record, fix_rules.FIX_SKIPPED, fix_rules.SKIP_NO_EDIT))
                continue
            record["note"] = proposal["note"]
            records.append(
                base.accept_candidate(
                    record=record,
                    item=item,
                    findings=open_items[item.item_id],
                    after=proposal["translation"],
                    budget=budgets[item.item_id],
                    no_growth=item.item_id in context["fit_constrained"],
                    pages=pages,
                    context=context,
                )
            )
        progress.step("rewrite", f"编辑部：第 {round_no} 轮整块重写 {index}/{len(batches)} 批")
    return records, budget_hit


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
        {"chief": chief_rules.CHIEF_PROMPT_VERSION, "rewrite": rewrite_rules.REWRITE_PROMPT_VERSION}
    )
    section = _editorial_section(_term_review_summary(translations_dir))
    report["editorial"] = section
    progress.total = 1
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
    scoped_ids = {item.item_id: item for item in candidates}
    qa_origin = review_rules.qa_findings(qa_current, items_by_id=scoped_ids, next_id=next_id)
    for finding in qa_origin:
        _open_issue(ledger, finding, actor=ROLE_QA)

    # 3. 争议：审校要改术语表锁定的译法 → 按术语表裁决。
    review_findings, disputes = _term_disputes(review_findings, items_by_id, locked_terms)
    for dispute in disputes:
        ledger.append(KIND_DISPUTE, actor=ROLE_REVIEWER, to=ROLE_CHIEF, refs=[dispute["item_id"]], **dispute)
        ledger.append(
            KIND_RULING, actor=ROLE_CHIEF, to=ROLE_TERMS, refs=[dispute["item_id"]],
            finding_id=dispute["finding_id"], ruling=RULING_KEEP_TERM_BASE,
        )
    section["disputes"] = disputes
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

    # 4. 多轮：主编分流 → 修订 → 验收。
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
    escalated: dict[str, str] = {}
    budget_hit = stopped == report_rules.STOP_MAX_TOKENS
    round_no = 0
    while open_items and round_no < chief_rules.MAX_ROUNDS and not budget_hit:
        round_no += 1
        _items, items_by_id = base._items_by_id(pages)
        progress.transition("chief", f"编辑部：第 {round_no} 轮，主编分流 {len(open_items)} 块", {"round": round_no})
        decisions, budget_hit = _triage(
            chats["chief"], open_items, attempts, items_by_id, progress=progress, errors=errors, round_no=round_no
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
                context=context, progress=progress, errors=errors, round_no=round_no,
            )
            for record in patched:
                record["action"] = chief_rules.ACTION_PATCH
            records.extend(patched)
            budget_hit = budget_hit or hit
        if rewrite_ids:
            rewritten, hit = _rewrite(
                chats["rewrite"], rewrite_ids, open_items, notes, pages=pages, locked_terms=locked_terms,
                style_notes=style_notes, context=context, progress=progress, errors=errors, round_no=round_no,
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
    for finding in findings:
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

    # 5. 报告。
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
