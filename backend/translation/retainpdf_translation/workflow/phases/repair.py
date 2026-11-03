from __future__ import annotations

import os
import time
from pathlib import Path

from retainpdf_base.events import emit_stage_progress
from retainpdf_base.events import emit_stage_transition
from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.artifacts import blocking_untranslated_items
from retainpdf_translation.core.provider_identity import is_deepseek_family_provider
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_translation.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_translation.llm.shared.provider_runtime import get_api_key
from retainpdf_translation.llm.shared.provider_runtime import normalize_base_url
from retainpdf_translation.llm.shared.provider_runtime import request_chat_content
from retainpdf_translation.services.agents import AgentRunContext
from retainpdf_translation.services.agents import TranslationAgentCoordinator
from retainpdf_translation.services.agents import TranslationAgentRuntime
from retainpdf_translation.services.agents import run_agent_repair_pipeline
from retainpdf_translation.services.agents.repair_pipeline import ISSUE_KIND_LABELS
from retainpdf_translation.services.finalization import recover_blocking_untranslated_items
from retainpdf_translation.services.postprocess import GarbledReconstructionRuntime
from retainpdf_translation.services.postprocess import reconstruct_garbled_page_payloads
from retainpdf_translation.workflow.pages import save_pages
from retainpdf_translation.workflow.pages import refresh_translation_units_and_collect_changed_pages


REPAIR_PROFILE_ENV = "RETAIN_TRANSLATION_REPAIR_PROFILE"
FAST_REPAIR_PROFILE = "fast"
QUALITY_REPAIR_PROFILE = "quality"
FINAL_RECOVERY_BASE_ITEMS = 64
FAST_AGENT_REPAIR_DEFAULT_LIMIT = 8
QUALITY_AGENT_REPAIR_MIN_LIMIT = 8
QUALITY_AGENT_REPAIR_MAX_LIMIT = 256


def run_garbled_reconstruction_stage(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    run_diagnostics: TranslationRunDiagnostics | None,
) -> None:
    if not _garbled_reconstruction_enabled():
        print("book: garbled reconstruction skipped by repair profile", flush=True)
        emit_stage_progress(
            stage="garbled_repair",
            substage="garbled_repair",
            message="乱码候选段修复已跳过",
            progress_current=0,
            progress_total=0,
            payload={"skipped_by_repair_profile": True, "repair_profile": _repair_profile()},
        )
        return
    reconstruct_started = time.perf_counter()
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_start("garbled_reconstruction")
    emit_stage_transition(
        stage="garbled_repair",
        substage="garbled_repair",
        message="开始修复乱码候选段",
        progress_current=0,
        progress_total=len(page_payloads),
    )
    summary = reconstruct_garbled_page_payloads(
        page_payloads,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        runtime=_garbled_reconstruction_runtime(
            api_key=api_key,
            model=model,
            base_url=base_url,
        ),
        progress_callback=lambda current, total, dirty_pages: emit_stage_progress(
            stage="garbled_repair",
            substage="garbled_repair",
            message=f"正在修复乱码候选段，第 {current}/{total} 项",
            # Candidate completion is not page completion (groups can span
            # pages). Publish candidate counts separately until final save.
            progress_current=0,
            progress_total=len(page_payloads),
            payload={
                "progress_unit": "page",
                "garbled_completed": current,
                "garbled_attempted": total,
                "dirty_pages": sorted(dirty_pages),
            },
        ),
    )
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_end("garbled_reconstruction")
        run_diagnostics.set_garbled_reconstruction_stats(summary)
    reconstructed_items = int(summary["garbled_reconstructed"])
    garbled_candidates = int(summary["garbled_candidates"])
    garbled_attempted = int(summary.get("garbled_attempted", garbled_candidates))
    garbled_skipped_by_budget = int(summary.get("garbled_skipped_by_budget", 0))
    dirty_pages = {int(page_idx) for page_idx in summary.get("dirty_pages", [])}
    if dirty_pages:
        dirty_pages.update(refresh_translation_units_and_collect_changed_pages(page_payloads))
        save_pages(page_payloads, translation_paths, dirty_pages)
    emit_stage_progress(
        stage="garbled_repair",
        substage="garbled_repair",
        message=f"乱码候选段处理完成，失败 {summary.get('garbled_failed', 0)} 项",
        progress_current=len(page_payloads),
        progress_total=len(page_payloads),
        elapsed_ms=int((time.perf_counter() - reconstruct_started) * 1000),
        payload={
            "progress_unit": "page",
            "garbled_candidates": garbled_candidates,
            "garbled_attempted": garbled_attempted,
            "garbled_skipped_by_budget": garbled_skipped_by_budget,
            "garbled_reconstructed": reconstructed_items,
            **{key: int(summary.get(key, 0)) for key in (
                "garbled_applied", "garbled_rejected", "garbled_no_result",
                "garbled_failed", "garbled_completed",
            )},
            "dirty_pages": sorted(dirty_pages),
        },
    )
    print(
        f"book: garbled reconstruction candidates={garbled_candidates} attempted={garbled_attempted} "
        f"skipped_by_budget={garbled_skipped_by_budget} reconstructed={reconstructed_items} "
        f"rejected={summary.get('garbled_rejected', 0)} no_result={summary.get('garbled_no_result', 0)} "
        f"failed={summary.get('garbled_failed', 0)} completed={summary.get('garbled_completed', 0)} "
        f"in {time.perf_counter() - reconstruct_started:.2f}s",
        flush=True,
    )


def _is_deepseek_provider(*, model: str, base_url: str) -> bool:
    # 口径收敛到 core.provider_identity;这里只负责先按 transport 语义归一化 base_url
    # (空 base_url -> 官方默认端点),判定本身不再在调用点嗅字符串。
    return is_deepseek_family_provider(model=model, base_url=normalize_base_url(base_url))


def _garbled_reconstruction_runtime(
    *,
    api_key: str,
    model: str,
    base_url: str,
) -> GarbledReconstructionRuntime:
    if _is_deepseek_provider(model=model, base_url=base_url):
        return GarbledReconstructionRuntime(
            api_key=api_key or get_api_key(required=False),
            model=model,
            base_url=base_url,
            provider_reason="job_provider",
            request_chat_content_fn=request_chat_content,
            normalize_base_url_fn=normalize_base_url,
        )

    deepseek_key = get_api_key(required=False)
    if deepseek_key:
        return GarbledReconstructionRuntime(
            api_key=deepseek_key,
            model=DEFAULT_MODEL,
            base_url=DEFAULT_BASE_URL,
            provider_reason="prefer_deepseek_api",
            request_chat_content_fn=request_chat_content,
            normalize_base_url_fn=normalize_base_url,
        )

    return GarbledReconstructionRuntime(
        api_key=api_key,
        model=model,
        base_url=base_url,
        provider_reason="job_provider_fallback",
        request_chat_content_fn=request_chat_content,
        normalize_base_url_fn=normalize_base_url,
    )


def run_agent_repair_stage(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    translation_context: TranslationControlContext | None,
    run_diagnostics: TranslationRunDiagnostics | None,
) -> dict[str, int]:
    if not _agent_repair_enabled():
        print("book: agent repair skipped by repair profile", flush=True)
        return {
            "reviewed_items": 0,
            "candidate_items": 0,
            "repaired_items": 0,
            "skipped_items": 0,
            "failed_items": 0,
        }
    flat_payload: list[dict] = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    blocking_untranslated = blocking_untranslated_items(page_payloads)
    repair_limit = _agent_repair_limit_from_env(
        payload_size=len(flat_payload),
        blocking_untranslated_count=len(blocking_untranslated),
    )
    if repair_limit <= 0:
        return {
            "reviewed_items": 0,
            "candidate_items": 0,
            "repaired_items": 0,
            "skipped_items": 0,
            "failed_items": 0,
        }
    repair_started = time.perf_counter()
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_start("agent_repair")
    emit_stage_transition(
        stage="agent_repair",
        substage="agent_repair",
        message="开始执行翻译结果修复",
        progress_current=0,
        progress_total=repair_limit,
        payload={"blocking_untranslated": len(blocking_untranslated)},
    )
    glossary_entries = list(
        getattr(
            translation_context.scoped_to_source_texts([]) if translation_context is not None else None,
            "glossary_entries",
            [],
        )
        or []
    )
    coordinator = (
        TranslationAgentCoordinator.from_control_context(translation_context)
        if translation_context is not None
        else TranslationAgentCoordinator()
    )
    runtime = TranslationAgentRuntime(
        api_key=api_key,
        context=AgentRunContext(model=model, base_url=base_url),
        request_chat_content_fn=request_chat_content,
    )
    translated_results = {
        str(item.get("item_id", "") or ""): {
            "decision": "translate",
            "translated_text": str(
                item.get("protected_translated_text")
                or item.get("translation_unit_protected_translated_text")
                or item.get("translated_text")
                or ""
            ),
        }
        for item in flat_payload
        if str(item.get("item_id", "") or "")
    }
    result = run_agent_repair_pipeline(
        payload=flat_payload,
        translated_results=translated_results,
        coordinator=coordinator,
        runtime=runtime,
        glossary_entries=glossary_entries,
        max_items=repair_limit,
        model=model,
        base_url=base_url,
        on_candidates=lambda candidates: emit_stage_progress(
            stage="agent_repair",
            substage="agent_repair",
            message=f"要修 {len(candidates)} 块：{_describe_issue_kinds(candidates)}",
            progress_current=0,
            progress_total=len(candidates),
            payload={"candidates": candidates[:50]},
        ),
        on_progress=lambda done, total, item_id: emit_stage_progress(
            stage="agent_repair",
            substage="agent_repair",
            message=f"正在修复第 {done}/{total} 块（{item_id}）",
            progress_current=done,
            progress_total=total,
            payload={"item_id": item_id},
        ),
    )
    summary = result.as_dict()
    # 只保存修过的块所在的页（以前整本重写：6574 页的书改 8 块要写半小时）
    _save_touched_pages(page_payloads, translation_paths, result.touched_item_ids, stage="agent_repair")
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_end("agent_repair")
    emit_stage_progress(
        stage="agent_repair",
        substage="agent_repair",
        message=(
            f"翻译结果修复完成：修好 {summary['repaired_items']} 块，"
            f"没采纳或失败 {summary['failed_items']} 块"
        ),
        progress_current=summary["repaired_items"],
        progress_total=summary["candidate_items"],
        elapsed_ms=int((time.perf_counter() - repair_started) * 1000),
        payload=summary,
    )
    print(
        "book: agent repair "
        f"candidates={summary['candidate_items']} repaired={summary['repaired_items']} "
        f"skipped={summary['skipped_items']} failed={summary['failed_items']} "
        f"in {time.perf_counter() - repair_started:.2f}s",
        flush=True,
    )
    return summary


def run_final_untranslated_recovery_stage(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    translation_context: TranslationControlContext | None,
    workers: int,
) -> dict[str, int]:
    target_language_name = str(
        getattr(translation_context, "target_language_name", "") if translation_context is not None else ""
    ) or "简体中文"
    blocking_before = len(blocking_untranslated_items(page_payloads))
    if blocking_before <= 0:
        return {
            "blocking_before": 0,
            "attempted_items": 0,
            "recovered_items": 0,
            "dead_letter_items": 0,
            "blocking_after": 0,
        }
    started = time.perf_counter()
    max_items = _final_recovery_limit_from_env(
        payload_size=sum(len(items) for items in page_payloads.values()),
    )
    emit_stage_transition(
        stage="final_untranslated_recovery",
        substage="final_untranslated_recovery",
        message="开始最终未翻译收口",
        progress_current=0,
        progress_total=blocking_before,
        payload={
            "blocking_untranslated": blocking_before,
            "max_items": max_items,
        },
    )
    result = recover_blocking_untranslated_items(
        page_payloads,
        api_key=api_key,
        model=model,
        base_url=base_url,
        target_language_name=target_language_name,
        max_items=max_items,
        workers=max(1, min(32, int(workers or 1))),
        request_chat_content_fn=request_chat_content,
        on_progress=lambda done, total, item_id: emit_stage_progress(
            stage="final_untranslated_recovery",
            substage="final_untranslated_recovery",
            message=f"正在补翻第 {done}/{total} 块（{item_id}）",
            progress_current=done,
            progress_total=total,
            payload={"item_id": item_id},
        ),
    )
    summary = result.as_dict()
    _save_touched_pages(page_payloads, translation_paths, result.touched_item_ids, stage="final_untranslated_recovery")
    emit_stage_progress(
        stage="final_untranslated_recovery",
        substage="final_untranslated_recovery",
        message=(
            f"最终未翻译收口完成：补成 {summary['recovered_items']} 块，"
            f"保留原文 {summary['dead_letter_items']} 块，还有 {summary['blocking_after']} 块没处理"
        ),
        progress_current=summary["attempted_items"],
        progress_total=blocking_before,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
        payload=summary,
    )
    print(
        "book: final untranslated recovery "
        f"before={summary['blocking_before']} attempted={summary['attempted_items']} "
        f"recovered={summary['recovered_items']} dead_letter={summary['dead_letter_items']} "
        f"skipped_by_budget={summary.get('skipped_by_budget', 0)} "
        f"after={summary['blocking_after']} in {time.perf_counter() - started:.2f}s",
        flush=True,
    )
    return summary


def _describe_issue_kinds(candidates: list[dict]) -> str:
    """「英文残留 5 块、术语没用上 2 块」。"""
    counts: dict[str, int] = {}
    for candidate in candidates:
        for kind in candidate.get("issue_kinds") or []:
            label = ISSUE_KIND_LABELS.get(str(kind), str(kind))
            counts[label] = counts.get(label, 0) + 1
    return "、".join(f"{label} {count} 块" for label, count in sorted(counts.items(), key=lambda pair: -pair[1])) or "无"


def _save_touched_pages(
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    touched_item_ids: tuple[str, ...],
    *,
    stage: str,
) -> None:
    """只保存这一轮改过的块所在的页，加上刷新翻译单元时跟着变了的页。"""
    wanted = {item_id for item_id in touched_item_ids if item_id}
    dirty_pages = {
        int(page_idx)
        for page_idx, items in page_payloads.items()
        if any(str(item.get("item_id", "") or "") in wanted for item in items)
    }
    if not dirty_pages:
        return
    dirty_pages.update(refresh_translation_units_and_collect_changed_pages(page_payloads))
    emit_stage_progress(
        stage=stage,
        substage=stage,
        message=f"正在保存改动过的 {len(dirty_pages)} 页",
        progress_current=None,
        progress_total=None,
        payload={"dirty_pages": len(dirty_pages)},
    )
    save_pages(page_payloads, translation_paths, dirty_pages)


def _final_recovery_limit_from_env(*, payload_size: int = 0) -> int:
    """最终补翻最多补几块：64 块加全书条目的 1%（6.9 万条的书约 750 块），环境变量照旧能定死。

    补不回来的块转成死信、保留原文、不阻断导出；超出名额的块没机会补，照样卡导出门禁。以前固定 64（事件里还报成
    快档 4，其实没传进去，补翻一直按 64 跑），几万条的书剩下几百块没补成就整本失败（2026-11-03，6574 页的手册
    386 块只补了 64 块）。名额跟着书的大小走，真的大面积失败（几千块）照样会被门禁拦下。
    """
    raw = str(os.environ.get("RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS", "") or "").strip()
    scaled = FINAL_RECOVERY_BASE_ITEMS + max(0, int(payload_size)) // 100
    if not raw:
        return scaled
    try:
        return max(0, int(raw))
    except ValueError:
        return scaled


def _agent_repair_limit_from_env(
    *,
    payload_size: int = 0,
    blocking_untranslated_count: int = 0,
) -> int:
    raw = str(os.environ.get("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", "") or "").strip()
    if not raw:
        if _repair_profile() != QUALITY_REPAIR_PROFILE:
            return _fast_agent_repair_limit(
                payload_size=payload_size,
                blocking_untranslated_count=blocking_untranslated_count,
            )
        return max(
            QUALITY_AGENT_REPAIR_MIN_LIMIT,
            min(QUALITY_AGENT_REPAIR_MAX_LIMIT, max(0, int(blocking_untranslated_count)) * 2),
            min(64, max(0, int(payload_size)) // 80),
        )
    try:
        return max(0, int(raw))
    except ValueError:
        return max(
            QUALITY_AGENT_REPAIR_MIN_LIMIT,
            min(QUALITY_AGENT_REPAIR_MAX_LIMIT, max(0, int(blocking_untranslated_count)) * 2),
        )


def _fast_agent_repair_limit(
    *,
    payload_size: int = 0,
    blocking_untranslated_count: int = 0,
) -> int:
    del payload_size
    blocking_untranslated_count = max(0, int(blocking_untranslated_count or 0))
    # fast 档只在存在阻塞级未译条目时才动用 agent 修复:原先的
    # broad_budget 会在任务完全干净时也按篇幅跑警告级候选,而这类候选
    # (英文残留为主)修复成功率极低、重验必拒,纯烧钱。quality 档不变。
    if blocking_untranslated_count <= 0:
        return 0
    return min(FAST_AGENT_REPAIR_DEFAULT_LIMIT, blocking_untranslated_count)


def _repair_profile() -> str:
    value = str(os.environ.get(REPAIR_PROFILE_ENV, "") or "").strip().lower()
    if value in {"quality", "strict", "full"}:
        return QUALITY_REPAIR_PROFILE
    return FAST_REPAIR_PROFILE


def _env_flag(name: str, default: bool) -> bool:
    value = str(os.environ.get(name, "") or "").strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _garbled_reconstruction_enabled() -> bool:
    return _env_flag(
        "RETAIN_TRANSLATION_GARBLED_RECONSTRUCTION",
        _repair_profile() == QUALITY_REPAIR_PROFILE,
    )


def _agent_repair_enabled() -> bool:
    return _env_flag(
        "RETAIN_TRANSLATION_AGENT_REPAIR",
        True,
    )


__all__ = [
    "run_agent_repair_stage",
    "run_final_untranslated_recovery_stage",
    "run_garbled_reconstruction_stage",
]
