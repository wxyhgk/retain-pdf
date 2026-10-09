// 文档进度 Tab：一张「进度」卡，内含 OCR / 翻译两个卡内分段。
// 所有 id、disabled 语义、onX 回调原样透传；数字只读传入的 ocr/translation。

import { BookTranslationWorkflowPanel } from "../panels/translate/WorkflowPanel.jsx";
import { ProcessingPipelineRail } from "../panels/processing/ProcessingPipelineRail.jsx";
import { PageSpecInput } from "../panels/PageSpecInput.js";
import { JobFailureCard } from "../panels/processing/JobFailureCard.js";
import { loadJobFailureDetail } from "../../domain/job-failure-detail.js";
import type { JobFailureBrief } from "@/platform/contracts/library-payloads.js";
import { ProcessingSummary, type ProcessingSummaryTone } from "../panels/processing/ProcessingSummary.jsx";
import { processingFacts } from "../../domain/translation-coverage.js";
import { JobHistoryPanel, TranslationCoveragePanel } from "../panels/processing/TranslationCoveragePanel.js";
import { btn } from "../panels/ui.jsx";
import { documentJobPresentation, isDocumentJobActive } from "../use-document-jobs.js";
import {
  countFromProgress,
  percentFromProgress,
  stageDetailWithoutPageCount,
  unitLabelFromProgress,
} from "../../domain/progress-value.js";
import { useState } from "react";
import { ChevronDown, LoaderCircle, Square } from "lucide-react";
import { TranslationStageActions } from "../panels/translate/TranslationStageActions.jsx";

function progressOf(source: any): { current?: number; total?: number; percent: number | null; unit: string } {
  const progress: any = source?.stage_snapshot?.progress || source?.progress || {};
  const percent = percentFromProgress(progress);
  const count = countFromProgress(progress);
  const unit = unitLabelFromProgress(progress);
  return count ? { current: count.current, total: count.total, percent, unit } : { percent, unit };
}

function progressTextOf(source: any): string | null {
  const { current, total, percent, unit } = progressOf(source);
  const parts: string[] = [];
  if (current !== undefined && total !== undefined) parts.push(unit ? `${current}/${total} ${unit}` : `${current}/${total}`);
  if (percent !== null) parts.push(`${Math.round(percent)}%`);
  return parts.length ? parts.join(" · ") : null;
}

/** 顶部一行状态：只读传入的真实任务数据，不编假数；OCR 活跃优先，否则跟翻译。 */
function unifiedHeadline(ocr: any, translation: any): string {
  if (ocr && isDocumentJobActive(ocr.job)) {
    const presentation = documentJobPresentation(ocr.job, "OCR 处理中");
    const progress = progressTextOf(ocr.job);
    return progress ? `OCR 处理中 · ${progress}` : `${presentation.label || "OCR 处理中"}`;
  }
  if (translation?.isActive) {
    const progress = progressTextOf(translation.item);
    return progress ? `翻译中 · ${progress}` : "翻译中";
  }
  return `${translation?.status?.label || "未翻译"}`;
}

/** 统一进度条：只在进行中出现；OCR 活跃跟 OCR，否则跟翻译；无真实数字时不渲染。
 *  完成后不再画一条满格的进度条 —— 它占一大块却什么也没说。 */
function unifiedPercentOf(ocr: any, translation: any): number | null {
  if (ocr && isDocumentJobActive(ocr.job)) return progressOf(ocr.job).percent;
  if (translation?.isActive) return progressOf(translation?.item).percent;
  return null;
}

function summaryToneOf(ocr: any, translation: any, ocrTone: string, keptOriginBlocks: number): ProcessingSummaryTone {
  if ((ocr && isDocumentJobActive(ocr.job)) || translation?.isActive) return "active";
  const tone = `${translation?.status?.tone || ""}`;
  if (tone === "failed" || (ocrTone === "failed" && tone !== "done")) return "failed";
  if (tone === "done") return keptOriginBlocks > 0 ? "warn" : "done";
  return "idle";
}

/** 翻译任务现在跑到哪一站（OCR / 翻译 / 渲染），给实时说明找位置。认不出就算翻译站。 */
function liveStageKey(item: any): "ocr" | "translate" | "render" {
  const stage = `${item?.stage_snapshot?.display_stage || item?.stage_snapshot?.stage || item?.stage || ""}`.toLowerCase();
  if (stage.startsWith("ocr")) return "ocr";
  if (stage.startsWith("render")) return "render";
  return "translate";
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8M8 15h6" />
    </svg>
  );
}

// resultActionsSlot：结果操作行（下载 / 对照阅读）由调用方注入，和交给
// WorkflowPanel 的 ocrActionSlot 同款。本组件保持纯展示——只读传入的 ocr/translation，不自己去
// 取全局服务；那四个按钮要读 statusCard store（useStatusCardModel），一旦直接
// 写在这里，孤立挂载本组件的组件级测试就会因为缺少 HomeShellProviders 而崩。
// 真正的注入点在 BookDetailDialog（它本来就在 providers 里）。
export function BookDetailProcessingTab({ ocr, translation, loading = false, error = "", resultActionsSlot = null, coverage = null }: any) {
  const ocrJob = ocr?.job ?? null;
  const ocrActive = isDocumentJobActive(ocrJob);
  const ocrStatus = documentJobPresentation(ocrJob, "尚未执行");
  const ocrStatusLabel = ocrStatus.tone === "active"
    ? "处理中"
    : ocrStatus.tone === "done"
      ? "已完成"
      : ocrStatus.tone === "failed"
        ? "失败"
        : "未执行";
  const unifiedPercent = unifiedPercentOf(ocr, translation);
  const facts = processingFacts(coverage);
  // 有任务在跑时，流水线每站只写「现在」的事：当前站写后端的实时说明（stage_detail），
  // 其它站不写 —— 覆盖接口给的是上一次跑完的结果，跑新任务时摆出来会让人以为是这次的。
  // 以前这句实时说明在单独一张卡里，和顶部的进度、下面状态卡的进度一起，同一件事说三遍。
  const liveSource = ocrActive ? ocrJob : translation?.isActive ? translation?.item : null;
  const liveDetail = liveSource
    ? stageDetailWithoutPageCount(
      `${(liveSource as any)?.stage_snapshot?.stage_detail || (liveSource as any)?.stage_detail || ""}`,
      Boolean(progressOf(liveSource).total),
    )
    : "";
  const stageMeta = liveSource
    ? (ocrActive ? { ocr: liveDetail } : { [liveStageKey(translation?.item)]: liveDetail })
    : facts.stageMeta;

  const translationItem = translation?.item || {};
  const translationJobId = `${translationItem.job_id || translationItem.active_job_id || ""}`.trim();
  const hasTranslationJob = Boolean(translationJobId) && !translationJobId.startsWith("doc:");

  // 「还不知道」不等于「确定没有」。这一段以前只让 loading 控制一行提示文案，
  // 下面整张流水线照旧渲染，于是 GET /documents/:id/jobs 还在路上的那几百毫秒，
  // 一份正在跑 OCR 的文档会被画成「OCR 未执行 / 尚未翻译」，「开始 OCR」还可点，
  // 点下去就并发出第二个任务。
  //
  // 判据是「有没有已知数据」而不是 loading 本身：use-document-jobs 的 loading
  // 每次非静默 refresh 都会翻真，若按 loading 直接切骨架，正盯进度的用户会看到
  // 界面反复闪回占位。所以只有「loading 且一条任务都还没见过」才算首帧未知。
  const hasKnownJobData = Boolean(ocrJob) || hasTranslationJob || Boolean(translation?.isActive);
  const bootstrapping = Boolean(loading) && !hasKnownJobData;

  const ocrConfigurable = !bootstrapping && !ocrActive && !ocr?.pending && !translation?.isActive;
  const translationDescription = translation.ocrReuse
    ? "复用已有 OCR，直接翻译并生成阅读产物"
    : "执行 OCR、翻译并生成阅读产物";
  // 翻译运行中不允许再单独发起 OCR：派生出的 OCR 状态此时是 succeeded，
  // 会让按钮显示成可点的「重新 OCR」，点下去会并发一个竞争任务。
  const translationActive = Boolean(translation?.isActive);
  const ocrBlockedByTranslation = translationActive && !ocrActive;
  // 只有真实的 OCR 任务才可取消：从翻译任务派生的合成 OCR(ocr_status_derived)
  // job_id 其实指向翻译任务，取消它会打错接口。
  const ocrJobId = `${ocrJob?.job_id || ocrJob?.id || ""}`.trim();
  const ocrJobIsReal = Boolean(ocrJobId) && !ocrJob?.ocr_status_derived && !ocrJobId.startsWith("doc:");
  const ocrCancelable = ocrActive && ocrJobIsReal && !translationActive;
  // 失败简报来自 document jobs 列表（后端 JobFailureBriefView）。合成的 OCR 任务
  // （ocr_status_derived）其实指向翻译任务，它的 failure 属于翻译那一段，不能
  // 在 OCR 段重复画一遍。
  const ocrFailure = ocrJobIsReal ? (ocrJob as { failure?: JobFailureBrief })?.failure ?? null : null;
  const translationFailure = (translationItem as { failure?: JobFailureBrief })?.failure ?? null;
  // OCR 动作与「翻译整本」同排，避免出现两行能力按钮。
  // 翻译进行中整组不出现：那时按钮只能是灰的（见 ocrBlockedByTranslation），
  // 摆一个点不了的「重新 OCR」只是干扰。
  const ocrAction = ocrBlockedByTranslation ? null : (
    <>
      <button
        id="book-detail-start-ocr-btn"
        type="button"
        className={btn("outline")}
        disabled={bootstrapping || Boolean(ocr?.pending) || ocrActive || ocrBlockedByTranslation || Boolean(translation?.busy)}
        title={ocrBlockedByTranslation ? "翻译进行中，暂不能单独执行 OCR" : undefined}
        onClick={ocr?.onOcr}
      >
        <ScanIcon />
        <span className="ml-1.5">{bootstrapping ? "读取中…" : ocr?.pending ? "提交中…" : ocrActive ? "OCR 处理中" : ocrJob ? "重新 OCR" : "开始 OCR"}</span>
      </button>
      {ocrCancelable ? (
        <button
          id="book-detail-cancel-ocr-btn"
          type="button"
          className={btn("outline")}
          disabled={Boolean(ocr?.cancelling)}
          onClick={() => ocr?.onCancel?.(ocrJobId)}
        >
          {ocr?.cancelling ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Square className="size-3.5" aria-hidden="true" />}
          <span className="ml-1.5">{ocr?.cancelling ? "取消中…" : "取消任务"}</span>
        </button>
      ) : null}
    </>
  );

  // OCR 指定页码：和翻译的「指定页码」放在同一个选项行里（动作区），不再单独占一张卡。
  const ocrOptions = ocrConfigurable ? (
    <div className="book-detail-ocr-range">
      <label className="book-detail-ocr-range-toggle">
        <input
          type="checkbox"
          checked={Boolean(ocr?.rangeOn)}
          onChange={(event) => ocr?.onRangeOnChange?.(event.target.checked)}
        />
        OCR 指定页码
      </label>
      {ocr?.rangeOn ? (
        <div className="book-detail-ocr-range-inputs">
          <PageSpecInput
            id="book-detail-ocr-pages"
            label="要 OCR 的页码"
            value={ocr?.pageSpec ?? ""}
            pageCount={ocr?.pageCount}
            onChange={(value) => ocr?.onPageSpecChange?.(value)}
          />
        </div>
      ) : null}
    </div>
  ) : null;

  // 书已经翻译完、此刻没有任务在跑：所有「再来一次」的动作收进卡片头的「重新处理」，
  // 点开才是一张清单（每项一行，自己的设置挨着自己的按钮）。三步进度这时也收起来 ——
  // 全是勾，只占地方。以前这些平铺在页面上：三步进度、四个按钮、OCR 页码勾选框、引擎下拉。
  const reprocessMode = hasTranslationJob
    && !translation?.canTranslate
    && !translationActive
    && !ocrActive
    && !bootstrapping
    && !ocr?.pending;
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const reprocessToggle = reprocessMode ? (
    <button
      id="book-detail-reprocess-toggle"
      type="button"
      className={btn("outline")}
      aria-expanded={reprocessOpen}
      aria-controls="book-detail-reprocess-sheet"
      onClick={() => setReprocessOpen((open) => !open)}
    >
      <span>重新处理</span>
      <ChevronDown
        className="ml-1 size-4 transition-transform"
        style={reprocessOpen ? { transform: "rotate(180deg)" } : undefined}
        aria-hidden="true"
      />
    </button>
  ) : null;
  const ocrRow = (
    <li className="book-detail-reprocess-row" data-reprocess-stage="ocr">
      <div className="book-detail-reprocess-copy">
        <strong>重新 OCR</strong>
        <span>重新识别版面和文字。之后要重新翻译，新结果才会用上。</span>
        {ocrOptions}
      </div>
      <div className="book-detail-reprocess-controls">
        <button
          id="book-detail-start-ocr-btn"
          type="button"
          className={btn("outline")}
          disabled={Boolean(ocr?.pending) || Boolean(translation?.busy)}
          onClick={ocr?.onOcr}
        >
          <ScanIcon />
          <span className="ml-1.5">{ocr?.pending ? "提交中…" : "开始"}</span>
        </button>
      </div>
    </li>
  );
  const reprocessSheet = reprocessMode && reprocessOpen ? (
    <div id="book-detail-reprocess-sheet">
      <TranslationStageActions
        variant="sheet"
        actions={translation?.stageActions}
        loading={translation?.stageActionsLoading}
        pendingStage={translation?.stageActionPending}
        error={translation?.stageActionError}
        onRetry={translation?.onRetryStage}
        extraRows={ocrRow}
      />
    </div>
  ) : null;
  // 翻全了就不画覆盖条：100% 的一排满格什么也没说。没翻全时它说明缺哪几页。
  const coverageIncomplete = Boolean(coverage?.page_count) && coverage.translated_pages < coverage.page_count;

  return (
    <div
      className="book-detail-tab-processing"
      data-book-detail-tab="processing"
    >
      {error ? <p className="rounded-lg border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{error}</p> : null}
      {loading ? <p className="text-xs text-muted-foreground">正在读取文档任务…</p> : null}
      {/* 全卡唯一 .book-detail-processing-card：OCR / 翻译收敛成同一条流水线。 */}
      <section className="book-detail-processing-card" data-processing-capability="processing" aria-label="处理">
        <ProcessingSummary
          headline={unifiedHeadline(ocr, translation)}
          tone={summaryToneOf(ocr, translation, ocrStatus.tone, facts.keptOriginBlocks)}
          percent={unifiedPercent}
          bootstrapping={bootstrapping}
          facts={facts.facts}
          keptOriginBlocks={facts.keptOriginBlocks}
          action={reprocessToggle}
        />
        {reprocessSheet}

        {/* 唯一轨道：OCR 是流水线第一站，不再是与翻译并列的能力标题。翻译完成后收起。 */}
        {reprocessMode ? null : <ProcessingPipelineRail
          item={translationItem}
          hasTranslationJob={hasTranslationJob}
          ocrStatus={{ ...ocrStatus, label: ocrStatusLabel }}
          translationStatus={translation.status}
          translationDescription={translationDescription}
          stageMeta={stageMeta}
          // 有任务在跑时各站只说现在的事：上一次的「N 块保留原文」不挂（顶部提醒同理）。
          translateWarning={!liveSource && facts.keptOriginBlocks > 0 ? `${facts.keptOriginBlocks} 块未能翻译` : ""}
          loading={bootstrapping}
        />}

        {/* OCR 段只剩契约占位和错误：进度在顶部，实时说明在流水线的 OCR 站下面。 */}
        <div className="book-detail-processing-segment" data-processing-region="ocr">
          <span
            id="book-detail-ocr-progress"
            className="sr-only"
            data-job-status={ocrJob?.status || (bootstrapping ? "loading" : "idle")}
            aria-hidden="true"
          />
          {ocr?.error ? <p className="rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{ocr.error}</p> : null}
        </div>

        {/* 失败诊断。OCR 和翻译各占全部失败的一半左右（6 和 4，外加 3 次上传超时
            也记在 OCR 段），所以两段都要能出卡片 —— 只做一边等于一半的失败仍然
            只有「失败」两个字。 */}
        {ocrFailure ? (
          <JobFailureCard
            failure={ocrFailure}
            jobId={ocrJobIsReal ? ocrJobId : ""}
            onRetry={ocr?.onOcr}
            retrying={Boolean(ocr?.pending)}
            loadDetail={loadJobFailureDetail}
          />
        ) : null}

        {/* 翻译细化：状态卡/阶段动作/选项/发起表单由 WorkflowPanel 承载（轨道已展示阶段）。
            唯一的行动行：OCR 按钮与「翻译整本 / 继续翻译」同排。 */}
        {/* 完成态的动作都收进了「重新处理」，这一段只在有话要说时出现（提交中、报错、失败），
            否则它是卡片底部一截空白。 */}
        {reprocessMode && !translation?.error && !translationFailure && !translation?.stageActionPending && !translation?.busy ? null : (
        <div className="book-detail-processing-segment" data-processing-region="translation">
          <BookTranslationWorkflowPanel
            {...translation}
            // 首帧未知时「翻译整本」同样不能是可点的确定态：这时 canTranslate
            // 由「还没见过任何任务」推出，点下去可能与在跑的任务撞车。
            canTranslate={bootstrapping ? false : translation.canTranslate}
            ocrActionSlot={reprocessMode ? null : ocrAction}
            ocrOptionsSlot={reprocessMode ? null : ocrOptions}
            hideStageActions={reprocessMode}
          />
          {translationFailure ? (
            <JobFailureCard
              failure={translationFailure}
              jobId={translationJobId}
              onRetry={translation?.onTranslate}
              retrying={Boolean(translation?.busy)}
              loadDetail={loadJobFailureDetail}
            />
          ) : null}
        </div>
        )}

        {/* 结果操作行（下载 / 对照阅读）。原挂在已下线的主页状态卡上，
            契约 id 原样保留——artifacts 域的 document 级委托靠它们接管点击。
            首帧未知时不渲染，避免「还不知道」被画成「已完成，请下载」。 */}
        {bootstrapping ? null : resultActionsSlot}
      </section>

      {/* 整本书翻了哪些页（多次范围翻译时由哪几次拼成）、做过哪些任务。和阅读入口同一套
          合并规则，这里说第 7 页来自哪次翻译，阅读器打开时就是那次。 */}
      {coverageIncomplete ? <TranslationCoveragePanel coverage={coverage} /> : null}
      <JobHistoryPanel coverage={coverage} />
    </div>
  );
}
