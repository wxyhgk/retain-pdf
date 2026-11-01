"""跟着 OCR 流式翻译：OCR 每公布一批页（`ocr/stream/`，契约在 `retainpdf_base.ocr_stream`），就翻一轮。

2026-10-31 用户：OCR 和翻译并行（"这样速度能达到极限"），跨栏、跨页拼接做成跟着 OCR 走的监控——"只要 ocr 过了两页，
我们就开始监控，进行拼接，然后同步交给翻译……这样就能不用等最后的时候了"。

每一轮：
1. 新到的页读进来（每页的翻译模板，已有译文的保留）。
2. **监控**：在已知的所有页上重算跨栏、跨页拼接（规则那一遍是瞬时的；它会先清掉上一轮的拼接再重算，所以模型复核的结论
   记在 `review_memo` 里，判过的对直接用，只把新出现的对交给模型），再做页面策略、上下文窗口。
3. **扣住还没定的那一段**：已到的页挨着还没到的页时，挨着的那一边能接过去的块（`continuation.rules.eligible`）——
   下一页没到就扣页末最后一个，上一页没到就扣页首第一个——连同它所在的拼接组，这一轮先不翻：它接不接邻页要等邻页到了才知道。
   其余拼好、确认独立的块马上翻（`pending_translation_items` 的 `deferred_item_ids`）。跨栏拼接只看本页，不用等。
4. 等下一版清单。OCR 做完（或页范围内的页都到了）的那一轮不扣，全部翻完，再做和整本一次翻一样的收尾。

到的页不一定连着（Paddle 按片并行，后面的片常先做完，见 `retainpdf_base.ocr_stream`）：跨页拼接只连相邻两页
（`continuation.rules` 里查着页号差 1），上下文窗口也不跨过没到的页（`services.context.windows`），所以先翻后面的页没问题。

拼接都在翻之前定，所以不会先翻半句、事后重翻。等的那段时间翻译池本来就空着：翻 10 页比 OCR 出 10 页快。
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import TYPE_CHECKING, Callable

from retainpdf_base.events import emit_stage_progress
from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.core.ocr.json_extractor import load_ocr_json
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation.services.context.windows import annotate_translation_context_windows
from retainpdf_translation.services.continuation.orchestrator import finalize_orchestration_metadata_by_page
from retainpdf_translation.services.continuation.rules import eligible
from retainpdf_translation.services.policy import TranslationPolicyConfig
from retainpdf_translation.workflow.book_flow import finish_book_translation
from retainpdf_base.ocr_stream import OcrStreamFailed
from retainpdf_base.ocr_stream import OcrStreamState
from retainpdf_base.ocr_stream import wait_for_ocr_stream
from retainpdf_translation.workflow.pages import load_page_payloads
from retainpdf_translation.workflow.pages import save_pages
from retainpdf_translation.workflow.stages import run_continuation_review
from retainpdf_translation.workflow.stages import run_initial_continuation_pass
from retainpdf_translation.workflow.stages import run_page_policy_stage
from retainpdf_translation.workflow.stages import run_translation_batch_stage

if TYPE_CHECKING:
    from retainpdf_translation.workflow.checkpoint import TranslationCheckpointSession


def held_back_item_ids(page_payloads: dict[int, list[dict]], *, page_indices: range) -> frozenset[str]:
    """还没定拼接的块：已到的页挨着页范围里还没到的页时，挨着那一边能接过去的块（下一页没到：页末最后一个；
    上一页没到：页首第一个），连同它已经在的拼接组（组里的块要整组一起翻）。"""
    window = set(page_indices)
    edges: list[dict] = []
    for page_idx, items in page_payloads.items():
        candidates = [item for item in items if eligible(item)]
        if not candidates:
            continue
        if page_idx + 1 in window and page_idx + 1 not in page_payloads:
            edges.append(candidates[-1])
        if page_idx - 1 in window and page_idx - 1 not in page_payloads:
            edges.append(candidates[0])
    held = {str(item.get("item_id", "") or "") for item in edges}
    groups = {str(item.get("continuation_group", "") or "") for item in edges} - {""}
    if groups:
        held.update(
            str(item.get("item_id", "") or "")
            for items in page_payloads.values()
            for item in items
            if str(item.get("continuation_group", "") or "") in groups
        )
    return frozenset(item_id for item_id in held if item_id)


def translate_book_streaming(
    *,
    data: dict,
    stream: OcrStreamState,
    ocr_dir: Path,
    output_dir: Path,
    page_indices: range,
    api_key: str,
    batch_size: int,
    workers: int,
    model: str,
    base_url: str,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
    domain_guidance: str = "",
    translation_context: TranslationControlContext | None = None,
    run_diagnostics: TranslationRunDiagnostics | None = None,
    checkpoint: TranslationCheckpointSession | None = None,
    wait: Callable[..., OcrStreamState] | None = None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    """`stream` 是建执行计划时已经等到的那一版清单（至少有一页），`data` 是它的前缀文档。返回值和 `translate_book_with_global_continuations` 一样。"""
    if translation_context is not None:
        domain_guidance = translation_context.merged_guidance
    elif not domain_guidance and policy_config is not None:
        domain_guidance = policy_config.domain_guidance
    math_mode = policy_config.math_mode if policy_config is not None else "direct_typst"
    context_mode = str(getattr(translation_context, "context_mode", "needed") if translation_context is not None else "needed")
    review_enabled = policy_config is None or policy_config.enable_candidate_continuation_review

    page_payloads: dict[int, list[dict]] = {}
    translation_paths: dict[int, Path] = {}
    review_memo: dict[tuple[str, str], bool] = {}
    # 翻译进度从第一轮开翻时的已完成块数算起，各轮接着数（见 `_BlockProgress`）
    progress_baseline: int | None = None
    started = time.perf_counter()
    rounds = 0
    while True:
        ready = stream.ready_page_indices
        new_pages = [page_idx for page_idx in page_indices if page_idx in ready and page_idx not in page_payloads]
        if new_pages:
            paths, payloads = load_page_payloads(data=data, output_dir=output_dir, page_indices=new_pages, math_mode=math_mode)
            translation_paths.update(paths)
            page_payloads.update(payloads)
        final = stream.done or all(page_idx in ready for page_idx in page_indices)
        rounds += 1
        _monitor_round(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            review_enabled=review_enabled,
            review_memo=review_memo,
            api_key=api_key,
            model=model,
            base_url=base_url,
            workers=workers,
            mode=mode,
            classify_batch_size=classify_batch_size,
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
            policy_config=policy_config,
            context_mode=context_mode,
            run_diagnostics=run_diagnostics,
            checkpoint=checkpoint,
            first_round=rounds == 1,
        )
        held = frozenset() if final or not page_payloads else held_back_item_ids(page_payloads, page_indices=page_indices)
        print(
            f"book: stream round={rounds} ocr_ready={stream.ready_pages}/{stream.total_pages} "
            f"pages={len(page_payloads)} held_back={len(held)} final={final}",
            flush=True,
        )
        emit_stage_progress(
            stage="translating",
            substage="ocr_stream",
            message=f"跟着 OCR 翻译：已到 {stream.ready_pages}/{stream.total_pages} 页",
            progress_current=stream.ready_pages,
            progress_total=stream.total_pages,
            payload={"progress_unit": "page", "round": rounds, "held_back_items": len(held)},
        )
        if checkpoint is not None and progress_baseline is None:
            progress_baseline = int((checkpoint.progress_snapshot() or {}).get("completed_item_count", 0) or 0)
        run_translation_batch_stage(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            batch_size=batch_size,
            workers=max(1, workers),
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            run_diagnostics=run_diagnostics,
            deferred_item_ids=held,
            progress_baseline_completed=progress_baseline,
            flush_callback=(
                lambda _pages, changed_item_ids_by_page: checkpoint.update(
                    "translating", page_payloads, translation_paths, changed_item_ids_by_page
                )
                if checkpoint is not None
                else None
            ),
            checkpoint_progress=(checkpoint.progress_snapshot if checkpoint is not None else None),
        )
        if final:
            break
        stream = (wait or wait_for_ocr_stream)(ocr_dir, after_seq=stream.seq)
        data = load_ocr_json(stream.document_path)
    print(f"book: stream translation rounds={rounds} in {time.perf_counter() - started:.2f}s", flush=True)
    return finish_book_translation(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=workers,
        translation_context=translation_context,
        run_diagnostics=run_diagnostics,
        checkpoint=checkpoint,
    )


def _monitor_round(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    review_enabled: bool,
    review_memo: dict[tuple[str, str], bool],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None,
    context_mode: str,
    run_diagnostics: TranslationRunDiagnostics | None,
    checkpoint: TranslationCheckpointSession | None,
    first_round: bool,
) -> None:
    """监控：在已知的所有页上定跨栏、跨页拼接，再做页面策略和上下文窗口（和 `prepare_book_payloads` 同样的几步）。

    断点的阶段只能往前走：第一轮照整本翻的 preparing → policy_ready；之后各轮已经在 translating，新到的页等页面策略
    做完再一起记进断点（策略之前新块还不算待翻，先记进去，策略一跑就成了"已完成的块又变回待翻"，断点会拒收）。"""
    if checkpoint is not None and first_round:
        checkpoint.update("preparing", page_payloads, translation_paths)
    run_initial_continuation_pass(page_payloads=page_payloads, translation_paths=translation_paths)
    if review_enabled:
        run_continuation_review(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            api_key=api_key,
            model=model,
            base_url=base_url,
            workers=workers,
            run_diagnostics=run_diagnostics,
            review_memo=review_memo,
        )
    run_page_policy_stage(
        page_payloads=page_payloads,
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        workers=max(1, workers),
        api_key=api_key,
        model=model,
        base_url=base_url,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
        run_diagnostics=run_diagnostics,
    )
    finalize_orchestration_metadata_by_page(page_payloads)
    annotate_translation_context_windows(page_payloads, mode=context_mode)
    save_pages(page_payloads, translation_paths)
    if checkpoint is not None:
        checkpoint.update("policy_ready" if first_round else "translating", page_payloads, translation_paths, detect_item_changes=not first_round)


__all__ = [
    "OcrStreamFailed",
    "held_back_item_ids",
    "translate_book_streaming",
]
