// 书籍详情「进度」页状态行右边的两个图标按钮：任务详情、取消任务（先确认）。
//
// 以前这是一张卡：取消 | 阶段名 + 已运行 | 详情，下面还有阶段导航、进度文案、阶段重试。进度页改版后，
// 阶段名、用时、进度都由状态行和流水线说，这里只剩两个动作。阶段导航、文案、重试这些节点照旧渲染在
// 一个隐藏的容器里：store 往这些 id 写字（setText），状态卡组件测试也按它们检查轮询和阶段选择。
import { useState } from "react";
import { StageFlow } from "./StageFlow.jsx";
import { Info, LoaderCircle, Square } from "lucide-react";
import { ConfirmDialog, IconButton } from "@retainpdf/ui";
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

export type StatusCardEmbeddedProps = {
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
    cancelError,
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
  // 取消要重新跑才能补回来，先问一句。以前点下去就取消，按钮还只是一个带下划线的小字。
  const [confirmCancel, setConfirmCancel] = useState(false);

  const rootClass = [
    "bd-job-status-card",
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
        data-layout="toolbar"
        data-selected-stage={selectedFlow}
      >
        <IconButton
          id={ids.detailButton}
          label="任务详情"
          className="bd-job-status-btn bd-job-status-btn-primary"
          onClick={openDetail}
        >
          <Info aria-hidden="true" />
        </IconButton>
        <IconButton
          id={ids.cancelButton}
          label="取消任务"
          className="bd-job-status-btn bd-job-status-btn-cancel"
          title={cancel.title}
          disabled={!cancelEnabled || cancelDisabled}
          onClick={() => setConfirmCancel(true)}
        >
          {cancel.busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Square aria-hidden="true" />}
        </IconButton>

        <div className="hidden" aria-hidden="true">
          <div id={ids.ringLabel}>{ringLabel}</div>
          <div id={ids.ringElapsed}>{elapsed.totalElapsedText}</div>
          <div className="bd-job-status-flow">
            <StageFlow
              currentStageKey={stageKeyForFlow}
              selectedStageKey={selectedForFlow}
              onSelectStage={selection.selectStage}
            />
          </div>
          <div id={ids.ringValue}>{valueText}</div>
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
            <div id={ids.stageRetry} />
          )}
          <div id={ids.stageDetail}>{detailText}</div>
          <div id={ids.progressBar} data-value={rounded} />
          <div id={ids.progressPercent} />
          <div id={ids.progressRing} />
          <div id={ids.progressText}>{progressText}</div>
          <div id={ids.stageErrorSummary}>{showError ? display.errorState.errorText : ""}</div>
        </div>

        {cancelError ? (
          <p className="bd-job-status-cancel-error" role="alert" data-cancel-error="true">
            {`取消没有成功：${cancelError}`}
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        id={`${idPrefix}cancel-confirm`}
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="取消这次处理？"
        description="任务会马上停止。已经完成的步骤会保留，之后可以从停下的地方继续，不用全部重来。"
        confirmLabel="取消任务"
        cancelLabel="继续处理"
        tone="danger"
        onConfirm={async () => {
          setConfirmCancel(false);
          await cancelCurrentJob?.();
        }}
      />
    </StatusCardIdsContext.Provider>
  );
}
