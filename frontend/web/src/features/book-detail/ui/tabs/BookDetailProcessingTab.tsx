// 文档「进度」页：一张卡，四层。
//
//   1. 状态行（ProcessingHeader）：状态图标、一句标题、一行带图标的小字，右边是这一刻能做的事
//      （ProcessingHeadTools）；下面一条进度条。这一页的按钮只在这里和流水线各站的 ↻ 上。
//   2. 流水线（ProcessingPipelineRail）：2.5D 的传送带和五台机器，各站写用时；失败的那台亮红灯。
//   3. 细节区（ProcessingDetails）：错误 / 编辑部 / 活动，只摆有内容的那几页。
//   4. 结果操作行（resultActionsSlot，下载 / 对照阅读）。
//
// 以前这一页从上到下是：摘要、流水线、最近活动、「查看实时译文」大卡、带「取消任务 / 详情」的状态卡、
// 一行说明，失败时再加一张自带四个按钮的失败卡；用时写三遍，按钮散在三处。
// 所有契约 id 和 onX 回调原样透传；数字只读传入的 ocr / translation，不编数。

import { Activity, PenLine, TriangleAlert } from "lucide-react";

import { ProcessingPipelineRail } from "../panels/processing/ProcessingPipelineRail.jsx";
import { PageSpecInput } from "../panels/PageSpecInput.js";
import { JobFailureCard } from "../panels/processing/JobFailureCard.js";
import { PrimaryActionButton, stoppedTranslationAction } from "../panels/processing/stopped-translation.jsx";
import { ProcessingHeader, coverageFactKind, type ProcessingHeaderFact } from "../panels/processing/ProcessingHeader.jsx";
import { ProcessingActivity, activityLinesOf } from "../panels/processing/ProcessingActivity.jsx";
import { ProcessingDetails, type ProcessingDetailSection } from "../panels/processing/ProcessingDetails.jsx";
import { loadJobFailureDetail } from "../../domain/job-failure-detail.js";
import type { JobFailureBrief } from "@/platform/contracts/library-payloads.js";
import { hasEditorialRoom, processingFacts } from "../../domain/translation-coverage.js";
import { TranslationCoveragePanel } from "../panels/processing/TranslationCoveragePanel.js";
import { documentJobPresentation, isDocumentJobActive } from "../use-document-jobs.js";
import { stageDetailWithoutPageCount } from "../../domain/progress-value.js";
import { formatElapsed, totalElapsedMs } from "../../domain/assembly-line-model.js";
import { resumeStageLabel } from "../../domain/job-resume-model.js";
import { translationProcessModel } from "../../domain/translation-process-model.js";
import { liveCountOf, liveStageKey, processingHeadOf, progressOf, unifiedPercentOf } from "./processing-summary-model.js";
import type { BookDetailProcessingTabProps } from "./processing-tab-types.js";
import { ProcessingHeadTools } from "../panels/processing/ProcessingHeadTools.jsx";
import { stationActionsOf } from "./processing-station-actions.jsx";
import { EditorialFlowPanel } from "../panels/processing/EditorialFlowPanel.jsx";
import { useEditorialFlow } from "../use-editorial-flow.js";
import { useJobTimeline } from "../use-job-timeline.js";
import { EditorialLivePanel, useEditorialLive } from "@/features/editorial-room/index.js";

// resultActionsSlot：结果操作行（下载 / 对照阅读）由调用方注入。本组件保持纯展示——只读传入的
// ocr/translation，不自己去取全局服务；那几个按钮要读 statusCard store（useStatusCardModel），一旦直接
// 写在这里，孤立挂载本组件的组件级测试就会因为缺少 HomeShellProviders 而崩。
// 真正的注入点在 BookDetailDialog（它本来就在 providers 里）。
export function BookDetailProcessingTab({ ocr, translation, loading = false, error = "", resultActionsSlot = null, coverage = null, editorialFlowCache }: BookDetailProcessingTabProps) {
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
  const facts = processingFacts(coverage);
  // 有任务在跑时，流水线每站只写「现在」的事：当前站写后端的实时说明（stage_detail），
  // 其它站不写 —— 覆盖接口给的是上一次跑完的结果，跑新任务时摆出来会让人以为是这次的。
  const liveSource = ocrActive ? ocrJob : translation?.isActive ? translation?.item : null;
  const liveDetail = liveSource
    ? stageDetailWithoutPageCount(
      `${liveSource?.stage_snapshot?.stage_detail || liveSource?.stage_detail || ""}`,
      Boolean(progressOf(liveSource).total),
    )
    : "";
  const stageMeta = liveSource
    ? (ocrActive ? { ocr: liveDetail } : { [liveStageKey(translation?.item)]: liveDetail })
    : facts.stageMeta;

  const translationItem = translation?.item || {};
  const translationJobId = `${translationItem.job_id || translationItem.active_job_id || ""}`.trim();
  const hasTranslationJob = Boolean(translationJobId) && !translationJobId.startsWith("doc:");
  const translationActive = Boolean(translation?.isActive);
  const tabVisible = translation?.tabActive !== false;
  // 精修跑在渲染阶段里：任务在跑且进入渲染时轮询事件流；跑完 / 停下后读一次，照样画出最后一次精修。
  // 只在「进度」页可见时才读事件：这一页和别的页签一起常驻挂载，不能一打开详情就去拉。
  const editorialFlow = useEditorialFlow(translationJobId, {
    enabled: hasTranslationJob && tabVisible,
    poll: translationActive && liveStageKey(translationItem) === "render",
    jobActive: translationActive,
    cache: editorialFlowCache,
  });
  // 翻译 agent 的编辑部画面：覆盖接口说这次是 agent 跑的才去读；任务在跑时轮询，跑完读一次。
  const editorialLive = useEditorialLive(translationJobId, {
    enabled: hasTranslationJob && tabVisible && hasEditorialRoom(coverage, translationJobId),
    poll: translationActive,
  });
  // 流水线各站的运行时间（任务详情的分段计时）：在跑时轮询，跑完读一次。
  const jobTimeline = useJobTimeline(translationJobId, { enabled: hasTranslationJob && tabVisible, poll: translationActive });

  // 「还不知道」不等于「确定没有」：GET /documents/:id/jobs 还在路上的那几百毫秒，一份正在跑 OCR 的文档
  // 不能被画成「OCR 未执行」、「只做 OCR」还可点（点下去就并发出第二个任务）。判据是「有没有已知数据」，
  // 不是 loading 本身：use-document-jobs 每次非静默 refresh 都会翻真，按 loading 切骨架会反复闪回占位。
  const hasKnownJobData = Boolean(ocrJob) || hasTranslationJob || translationActive;
  const bootstrapping = Boolean(loading) && !hasKnownJobData;

  // 只有真实的 OCR 任务才可取消：从翻译任务派生的合成 OCR(ocr_status_derived) job_id 其实指向翻译任务。
  const ocrJobId = `${ocrJob?.job_id || ocrJob?.id || ""}`.trim();
  const ocrJobIsReal = Boolean(ocrJobId) && !ocrJob?.ocr_status_derived && !ocrJobId.startsWith("doc:");
  const ocrCancelable = ocrActive && ocrJobIsReal && !translationActive;
  // 失败简报来自 document jobs 列表（后端 JobFailureBriefView）。合成的 OCR 任务的 failure 属于翻译那一段。
  const ocrFailure = ocrJobIsReal ? (ocrJob as { failure?: JobFailureBrief })?.failure ?? null : null;
  const translationFailure = (translationItem as { failure?: JobFailureBrief })?.failure ?? null;
  const translationStatusKey = `${translationItem.status || ""}`.trim().toLowerCase();
  const translationFailed = hasTranslationJob && translationStatusKey === "failed";
  const translationCancelled = hasTranslationJob && (translationStatusKey === "canceled" || translationStatusKey === "cancelled");
  const translationStopped = translationFailed || translationCancelled;
  // 同一次运行的 OCR 失败（翻译任务的 -ocr 子任务，或翻译任务自己就是死在 OCR）只说一遍。
  const ocrFailureCovered = translationFailed && (
    ocrJobId === `${translationJobId}-ocr` || `${translationFailure?.stage || ""}` === "ocr"
  );
  const ocrFailureShown = Boolean(ocrFailure) && !ocrFailureCovered;

  // 书已经翻译完（或任务停下）、此刻没有任务在跑：重做的动作挂在流水线各站上。
  const stationMode = hasTranslationJob
    && (!translation?.canTranslate || translationStopped)
    && !translationActive
    && !ocrActive
    && !bootstrapping
    && !ocr?.pending;
  const stationActions = stationMode ? stationActionsOf({ ocr, translation, translationStopped }) : {};

  // 状态行的主按钮：停下的翻译任务按续跑计划；只有 OCR 失败时是「重新 OCR」。
  const stopped = translationStopped
    ? stoppedTranslationAction({ resume: translation?.resume, onRestart: translation?.onTranslate, restarting: translation?.busy === "translate" })
    : { primary: null, notice: "" };
  const ocrRetry = ocr?.onOcr ? { label: "重新 OCR", hint: "重新识别版面和文字。", onClick: ocr.onOcr, pending: Boolean(ocr?.pending) } : null;
  const ocrIsPrimary = !translationStopped && ocrFailureShown;
  const primary = ocrIsPrimary ? ocrRetry : stopped.primary;
  const actionError = translationStopped ? translation?.resume?.error || "" : "";

  const { headline, tone } = processingHeadOf(ocr, translation, {
    ocrTone: ocrStatus.tone,
    keptOriginBlocks: facts.keptOriginBlocks,
    translationStatus: hasTranslationJob ? translationStatusKey : "",
  });
  const jobActive = translationActive || ocrActive;
  const totalMs = bootstrapping ? null : totalElapsedMs(jobTimeline.timeline, { now: jobTimeline.now, jobActive: translationActive });
  // 停在哪一站：任务记录认得出就用它；认不出（阶段字段常被清掉）再看任务的 stage、失败简报、续跑计划从哪站接着跑。
  const stoppedAt = translationStopped
    ? [
      translationProcessModel(translationItem).currentStage,
      translationItem.stage,
      translationFailure?.stage,
      translation?.resume?.plan?.from_stage,
    ].map(resumeStageLabel).find(Boolean) || ""
    : "";
  const headFacts: ProcessingHeaderFact[] = [];
  if (jobActive || translationStopped) {
    if (stoppedAt) headFacts.push({ key: "stopped", kind: "stopped", text: `停在${stoppedAt}` });
    const count = liveCountOf(ocr, translation);
    if (count) headFacts.push({ key: "count", kind: "count", text: count });
    if (totalMs) headFacts.push({ key: "time", kind: "time", text: `${jobActive ? "已运行" : "用时"} ${formatElapsed(totalMs)}` });
  } else {
    if (translation?.ocrReuse && !hasTranslationJob) headFacts.push({ key: "reuse", kind: "reuse", text: "复用已有 OCR" });
    facts.facts.forEach((text) => headFacts.push({ key: text, kind: coverageFactKind(text), text }));
    if (!facts.facts.length && ocr?.pageCount) headFacts.push({ key: "pages", kind: "pages", text: `${ocr.pageCount} 页` });
  }
  // 进度条只在跑的时候画。停下的任务不画：任务记录里的进度常常是最后一个阶段自己的（渲染 100%），
  // 画出来像跑完了；停在哪一站由流水线说（那台机器亮红灯）。
  const runningPercent = unifiedPercentOf(ocr, translation);
  const bar = jobActive ? runningPercent : null;

  // 细节区：错误、编辑部、活动，按要紧程度排；只摆有内容的。错误按段标 data-processing-region（ocr / translation）。
  const failureBlocks = [
    translationStopped && translationFailed ? (
      <div key="translation" data-processing-region="translation">
        <JobFailureCard
          failure={(ocrFailureCovered && ocrFailure) || translationFailure}
          jobId={translationJobId}
          hint={stopped.primary?.hint}
          notice={stopped.notice}
          actionError={actionError}
          loadDetail={loadJobFailureDetail}
        />
      </div>
    ) : null,
    ocrFailureShown ? (
      <div key="ocr" data-processing-region="ocr">
        <JobFailureCard
          failure={ocrFailure}
          jobId={ocrJobIsReal ? ocrJobId : ""}
          hint={ocrIsPrimary ? ocrRetry?.hint : ""}
          loadDetail={loadJobFailureDetail}
          // 两段都失败时状态行上是翻译的续跑，OCR 这段自己带一个「重新 OCR」。
          action={!ocrIsPrimary && ocrRetry ? (
            <PrimaryActionButton id="book-detail-ocr-retry" action={ocrRetry} variant="secondary" />
          ) : null}
        />
      </div>
    ) : null,
  ].filter(Boolean);
  const hasEditorial = Boolean(editorialLive?.events.length) || Boolean(editorialFlow);
  const activityProps = { item: translationItem, timeline: jobTimeline.timeline, jobActive: translationActive, loading: bootstrapping };
  const sections: ProcessingDetailSection[] = [];
  if (failureBlocks.length) {
    sections.push({ key: "errors", label: "错误", icon: <TriangleAlert aria-hidden="true" />, alert: true, content: <div className="book-detail-processing-errors">{failureBlocks}</div> });
  }
  if (hasEditorial) {
    sections.push({
      key: "editorial",
      label: "编辑部",
      icon: <PenLine aria-hidden="true" />,
      content: (
        <>
          <EditorialLivePanel live={editorialLive} active={translationActive} />
          <EditorialFlowPanel flow={editorialFlow} />
        </>
      ),
    });
  }
  if (activityLinesOf(activityProps).length) {
    sections.push({ key: "activity", label: "活动", icon: <Activity aria-hidden="true" />, content: <ProcessingActivity {...activityProps} /> });
  }

  // 「指定页码」打开时，状态行下面一行页码输入；翻译和只做 OCR 共用这一份页码。
  const rangeRow = !stationMode && !translationActive && !ocrActive && !bootstrapping && translation?.rangeOn ? (
    <div className="book-detail-processing-range">
      <PageSpecInput
        id="book-detail-translate-pages"
        label="要处理的页码"
        value={translation?.pageSpec ?? ""}
        pageCount={translation?.pageCount}
        onChange={(value) => {
          translation?.onPageSpecChange?.(value);
          ocr?.onPageSpecChange?.(value);
        }}
      />
    </div>
  ) : null;
  const alerts = [
    error ? { key: "tab", id: undefined, text: error } : null,
    ocr?.error ? { key: "ocr", id: undefined, text: ocr.error } : null,
    translation?.error ? { key: "translation", id: "book-detail-translate-error", text: translation.error } : null,
    translationCancelled && !translationFailed && (stopped.notice || actionError)
      ? { key: "stopped", id: undefined, text: actionError || stopped.notice }
      : null,
  ].filter((alert): alert is { key: string; id: string | undefined; text: string } => Boolean(alert));

  // 翻全了就不画覆盖条：100% 的一排满格什么也没说。没翻全时它说明缺哪几页。
  const coverageIncomplete = Boolean(coverage?.page_count) && (coverage?.translated_pages ?? 0) < (coverage?.page_count ?? 0);

  return (
    <div className="book-detail-tab-processing" data-book-detail-tab="processing">
      <section className="book-detail-processing-card" data-processing-capability="processing" aria-label="处理">
        <ProcessingHeader
          headline={headline}
          tone={tone}
          percent={jobActive ? runningPercent : null}
          bar={bar}
          bootstrapping={bootstrapping}
          facts={headFacts}
          keptOriginBlocks={facts.keptOriginBlocks}
          tools={(
            <ProcessingHeadTools
              ocr={ocr}
              translation={translation}
              bootstrapping={bootstrapping}
              stationMode={stationMode}
              ocrActive={ocrActive}
              ocrCancelable={ocrCancelable}
              ocrJobId={ocrJobId}
              translationStopped={translationStopped}
              translationCancelled={translationCancelled}
              primary={primary}
              primaryIsOcr={ocrIsPrimary}
              translateHint={translation?.ocrReuse ? "复用已有 OCR，直接翻译并生成阅读产物" : "执行 OCR、翻译并生成阅读产物"}
            />
          )}
        >
          {rangeRow}
          {translationCancelled && stopped.primary?.hint ? (
            <p className="book-detail-processing-note" data-job-cancelled="true">{stopped.primary.hint}</p>
          ) : translationCancelled ? (
            <span className="sr-only" data-job-cancelled="true">任务已取消</span>
          ) : null}
          {alerts.map((alert) => (
            <p key={alert.key} id={alert.id} className="book-detail-processing-alert" role="alert">
              <TriangleAlert aria-hidden="true" />
              {alert.text}
            </p>
          ))}
        </ProcessingHeader>

        {/* 唯一轨道：OCR 是流水线第一站。翻译完成后照样画，重做的动作挂在各站的 ↻ 上。 */}
        <ProcessingPipelineRail
          item={translationItem}
          hasTranslationJob={hasTranslationJob}
          ocrStatus={{ ...ocrStatus, label: ocrStatusLabel }}
          translationStatus={translation.status}
          translationDescription={translation?.ocrReuse ? "复用已有 OCR，直接翻译" : ""}
          stageMeta={stageMeta}
          // 有任务在跑时各站只说现在的事：上一次的「N 块保留原文」不挂。
          translateWarning={!liveSource && facts.keptOriginBlocks > 0 ? `${facts.keptOriginBlocks} 块未能翻译` : ""}
          loading={bootstrapping}
          timeline={jobTimeline.timeline}
          now={jobTimeline.now}
          stationActions={stationActions}
        />

        {/* 契约占位：OCR 段的任务状态（测试和门禁按它找）。 */}
        <span
          id="book-detail-ocr-progress"
          className="sr-only"
          data-job-status={ocrJob?.status || (bootstrapping ? "loading" : "idle")}
          aria-hidden="true"
        />

        <ProcessingDetails sections={sections} />

        {/* 结果操作行（下载 / 对照阅读）。契约 id 原样保留——artifacts 域的 document 级委托靠它们接管点击。
            首帧未知时不渲染，避免「还不知道」被画成「已完成，请下载」。 */}
        {bootstrapping ? null : resultActionsSlot}
      </section>

      {/* 整本书翻了哪些页（多次范围翻译时由哪几次拼成）。每次任务的明细在「历史」页签。 */}
      {coverageIncomplete ? <TranslationCoveragePanel coverage={coverage} /> : null}
    </div>
  );
}
