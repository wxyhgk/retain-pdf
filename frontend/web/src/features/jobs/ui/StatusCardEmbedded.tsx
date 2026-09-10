// 书籍详情「翻译」Tab 进度：
// - StageFlow：纯阶段导航
// - 进度文案行右侧：仅当前选中阶段的「重新 OCR / 翻译 / 渲染」
//   （动作与导航分离，不挤 pill、不顶乱布局）

import { StageFlow } from "./StageFlow.jsx";
import { LoaderCircle, Square } from "lucide-react";
import { buildProgressRenderModel, type ProgressRenderModelInput } from "../domain/progress-model.js";
import { StatusCardIdsContext } from "./status-card-ids-context.js";
import {
  useStatusCardModel,
  hasCancellableStatusCardJob,
  normalizeStatusCardFlowKey,
  dispatchStatusCardRetryStage,
} from "./use-status-card-model.js";
import type { StatusCardFallbackItem } from "../domain/merge-snapshot-with-fallback.js";
import type {
  StatusCardSnapshot,
} from "../domain/status-card-store.js";

function resolvePercent(
  renderOptions: ProgressRenderModelInput | null | undefined,
  snapshot: StatusCardSnapshot | null | undefined,
) {
  const status = `${snapshot?.status || ""}`.trim().toLowerCase();
  const stageKey = `${snapshot?.stageKey || ""}`.trim();
  if (status === "succeeded" || stageKey === "done") return 100;

  const model = buildProgressRenderModel(renderOptions || {});
  if (Number.isFinite(Number(model?.percent)) && (model.visible || Number(model.percent) > 0)) {
    return Math.max(0, Math.min(100, Number(model.percent)));
  }
  const fromSnap = Number(snapshot?.displayPercent ?? snapshot?.progressPercent);
  if (Number.isFinite(fromSnap)) return Math.max(0, Math.min(100, fromSnap));
  const cur = Number(snapshot?.progressCurrent);
  const tot = Number(snapshot?.progressTotal);
  if (Number.isFinite(cur) && Number.isFinite(tot) && tot > 0) {
    return Math.max(0, Math.min(100, (cur / tot) * 100));
  }
  if (status === "running" || status === "queued") return 8;
  return 0;
}

function isRedundantDoneDetail(detail: string, value: string, title: string) {
  const d = `${detail || ""}`.trim();
  if (!d) return true;
  const compact = d.replace(/\s+/g, "");
  const redundant = new Set([
    "渲染完成",
    "任务完成",
    "处理完成",
    "已完成",
    "完成",
    "翻译PDF已生成",
    "可以对照阅读",
    "处理完成，可以对照阅读",
  ]);
  if (redundant.has(compact)) return true;
  if (compact === `${value || ""}`.trim().replace(/\s+/g, "")) return true;
  if (compact === `${title || ""}`.trim().replace(/\s+/g, "")) return true;
  if (/^(渲染|任务|处理)?完成/.test(compact) && compact.length <= 12) return true;
  return false;
}

type StatusCardEmbeddedProps = {
  visible?: boolean;
  idPrefix?: string;
  rootId?: string;
  className?: string;
  fallbackItem?: StatusCardFallbackItem | null;
};

export function StatusCardEmbedded({
  visible = true,
  idPrefix = "book-detail-",
  rootId = "book-detail-job-status-card",
  className = "",
  fallbackItem = null,
}: StatusCardEmbeddedProps) {
  const model = useStatusCardModel({
    embedded: true,
    idPrefix,
    fallbackItem,
  });

  const {
    ids,
    snapshot,
    display,
    selection,
    elapsed,
    lottie,
    renderOptions,
    ringLabel,
    stageKeyForFlow,
    selectedForFlow,
    cancelDisabled,
    cancelCurrentJob,
    cancel,
    selectedRetry: retry,
    openDetail,
    visualStageKey,
  } = model;

  const status = `${snapshot?.status || ""}`.trim().toLowerCase();
  const percent = resolvePercent(renderOptions, snapshot);
  const valueText = `${snapshot?.value || ""}`.trim()
    || (status === "succeeded" ? "翻译 PDF 已生成" : "准备中");
  const rawDetail = `${display?.detailText || snapshot?.detail || ""}`.trim();
  const failed = status === "failed";
  const succeeded = status === "succeeded";
  const doneStage = normalizeStatusCardFlowKey(selectedForFlow) === "done"
    || normalizeStatusCardFlowKey(stageKeyForFlow) === "done"
    || succeeded;
  const detailText = (doneStage && isRedundantDoneDetail(rawDetail, valueText, ringLabel))
    ? ""
    : rawDetail;
  const showError = Boolean(display?.errorState?.showError && display?.errorState?.errorText);
  const rounded = Math.round(percent);
  const rawProgressText = renderOptions
    ? (buildProgressRenderModel(renderOptions).text || "")
    : "";
  const progressText = (doneStage && isRedundantDoneDetail(rawProgressText, valueText, ringLabel))
    ? ""
    : rawProgressText;
  const jobId = `${snapshot?.jobId || ""}`.trim();
  const cancelEnabled = hasCancellableStatusCardJob(snapshot?.jobId, snapshot?.status, {
    excludeDocPrefix: true,
  });
  const selectedFlow = normalizeStatusCardFlowKey(selectedForFlow || stageKeyForFlow);

  const rootClass = [
    "bd-job-status-card",
    "bd-job-status-card--bar",
    !visible ? "hidden" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <StatusCardIdsContext.Provider value={ids}>
      <div
        id={rootId}
        className={rootClass}
        data-status={`${snapshot.status || ""}`.trim()}
        data-visual-stage-key={lottie.visualStageKey || visualStageKey}
        data-embedded="true"
        data-layout="bar-action"
        data-selected-stage={selectedFlow}
      >
        <div className="bd-job-status-inner">
          <div className="bd-job-status-head">
            <button
              id={ids.cancelButton}
              type="button"
              className="bd-job-status-btn bd-job-status-btn-cancel"
              aria-label="取消任务"
              title={cancel.title}
              disabled={!cancelEnabled || cancelDisabled}
              onClick={() => cancelCurrentJob?.()}
            >
              {cancel.busy ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Square aria-hidden="true" />
              )}
              <span>{cancel.label}</span>
            </button>
            <div className="bd-job-status-head-center">
              <div id={ids.ringLabel} className="bd-job-status-title">{ringLabel}</div>
              <div id={ids.ringElapsed} className="bd-job-status-elapsed">
                {elapsed.totalElapsedText}
              </div>
            </div>
            <button
              id={ids.detailButton}
              type="button"
              className="bd-job-status-btn bd-job-status-btn-primary"
              aria-label="任务详情"
              onClick={openDetail}
            >
              详情
            </button>
          </div>

          <div className="bd-job-status-flow">
            <StageFlow
              currentStageKey={stageKeyForFlow}
              selectedStageKey={selectedForFlow}
              onSelectStage={selection.selectStage}
            />
          </div>

          <div className="bd-job-status-main">
            <div className="bd-job-status-copy">
              {/* 标题行：左侧状态文案，右侧「重新 xxx」（仅当前阶段） */}
              <div className="bd-job-status-value-row">
                <div id={ids.ringValue} className="bd-job-status-value">
                  {valueText}
                </div>
                {retry ? (
                  <button
                    type="button"
                    id={ids.stageRetry}
                    className="bd-job-status-retry-action"
                    data-retry-stage={retry.dispatchStage}
                    title={retry.title}
                    onClick={() => dispatchStatusCardRetryStage(retry.dispatchStage, jobId)}
                  >
                    {retry.label}
                  </button>
                ) : (
                  <div id={ids.stageRetry} className="hidden" aria-hidden="true" />
                )}
              </div>
              <div
                id={ids.stageDetail}
                className={`bd-job-status-detail${detailText ? "" : " is-empty"}`}
                title={detailText || undefined}
              >
                {detailText || "\u00a0"}
              </div>
              <div className="bd-job-status-bar-row">
                <div
                  id={ids.progressBar}
                  className={`bd-job-status-bar${succeeded ? " is-done" : ""}${failed ? " is-failed" : ""}`}
                  role="progressbar"
                  aria-label="翻译进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={rounded}
                >
                  <div className="bd-job-status-bar-fill" style={{ width: `${rounded}%` }} />
                </div>
                <span
                  id={ids.progressPercent}
                  className="bd-job-status-percent"
                  aria-hidden="true"
                >
                  {rounded}%
                </span>
              </div>
              <div id={ids.progressRing} className="hidden" aria-hidden="true" />
              <div
                id={ids.progressText}
                className={`bd-job-status-bar-meta${progressText ? "" : " is-empty"}`}
              >
                {progressText || "\u00a0"}
              </div>
            </div>
          </div>

          <div
            id={ids.stageErrorSummary}
            className={`bd-job-status-error${showError ? "" : " is-empty"}`}
          >
            {showError ? display.errorState.errorText : "\u00a0"}
          </div>
        </div>
      </div>
    </StatusCardIdsContext.Provider>
  );
}
