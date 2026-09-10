// 主流程 StatusCard 展示：status-card-shell + hero（DOM 契约 id 保留）。

import { StageFlow } from "./StageFlow.jsx";
import { SubstageFlow } from "./SubstageFlow.jsx";
import { ProgressBlock } from "./ProgressBlock.jsx";
import { ResultActions } from "./ResultActions.jsx";
import { StageRetry } from "./StageRetry.jsx";
import { StatusCardIdsContext } from "./status-card-ids-context.js";
import { useStatusCardModel, hasCancellableStatusCardJob, type StatusCardPrimaryActions } from "./use-status-card-model.js";
import { LoaderCircle, Square } from "lucide-react";

type StatusCardMainProps = {
  visible?: boolean;
  showResultActions?: boolean;
  showHiddenContract?: boolean;
  className?: string;
};

export function StatusCardMain({
  visible = true,
  showResultActions = true,
  showHiddenContract = true,
  className = "",
}: StatusCardMainProps) {
  const model = useStatusCardModel({ embedded: false });
  const {
    services,
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
    openDetail,
    visualStageKey,
  } = model;

  const rootClassNames = ["card", "status-card"];
  if (!visible) rootClassNames.push("hidden");
  if (lottie.hasStageAnimation) rootClassNames.push("has-stage-animation");
  if (lottie.isTranslationStage) rootClassNames.push("is-translation-stage");
  if (display.errorState.bodyHasError) rootClassNames.push("has-result-actions-error");
  if (className) rootClassNames.push(className);

  const primaryActions = (display.primaryActions || {}) as Partial<StatusCardPrimaryActions>;
  const hasCancellableJob = hasCancellableStatusCardJob(snapshot.jobId, snapshot.status);
  const hasResultActions = showResultActions && Boolean(
    primaryActions.markdownBundleReady
    || primaryActions.pdfReady
    || primaryActions.readerReady
    || primaryActions.sourcePdfReady,
  );
  const bodyClassNames = ["status-card-body"];
  if (display.errorState.bodyHasError) bodyClassNames.push("has-error");
  if (hasResultActions) bodyClassNames.push("has-result-actions");

  return (
    <StatusCardIdsContext.Provider value={ids}>
      <div
        id="job-status-card"
        className={rootClassNames.join(" ")}
        data-status={`${snapshot.status || ""}`.trim()}
        data-visual-stage-key={lottie.visualStageKey || visualStageKey}
        data-current-stage-key={selection.currentStageKey}
        data-selected-stage-key={selection.selectedStageKey}
        data-manual-stage-selection={selection.manualStageSelection ? "true" : "false"}
        data-embedded="false"
      >
        <div className="status-card-shell">
          <div className={bodyClassNames.join(" ")}>
            <div className="status-head">
              <button
                id={ids.cancelButton}
                type="button"
                className="status-action-btn status-head-btn status-head-cancel"
                aria-label="取消任务"
                title={cancel.title}
                disabled={!hasCancellableJob || cancelDisabled}
                onClick={() => cancelCurrentJob?.()}
              >
                {cancel.busy ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Square className="size-3.5" aria-hidden="true" />
                )}
                <span>{cancel.label}</span>
              </button>
              <div className="status-head-center">
                <div id={ids.ringLabel} className="status-ring-label">{ringLabel}</div>
                <div id={ids.ringElapsed} className="status-ring-elapsed">
                  {elapsed.totalElapsedText}
                </div>
              </div>
              <button
                id={ids.detailButton}
                type="button"
                className="status-action-btn status-head-btn status-head-detail"
                aria-label="任务详情"
                title="任务详情"
                onClick={openDetail}
              >
                <span>详情</span>
              </button>
            </div>

            <StageFlow
              currentStageKey={stageKeyForFlow}
              selectedStageKey={selectedForFlow}
              onSelectStage={selection.selectStage}
            />

            <div
              id={ids.stageErrorSummary}
              className={`status-stage-error-summary${display.errorState.showError ? "" : " hidden"}`}
            >
              {display.errorState.errorText}
            </div>

            <section className="status-progress-hero">
              <div className="status-animation-wrap">
                <div
                  id="status-stage-animation"
                  className={`status-stage-animation${lottie.hasStageAnimation ? "" : " hidden"}`}
                  aria-label="任务阶段动画"
                >
                  <div
                    id="status-stage-lottie"
                    ref={lottie.containerRef}
                    className={`status-stage-lottie${lottie.isFallback ? " is-fallback" : ""}`}
                  />
                </div>
              </div>
              <div className="status-progress-content">
                <div className="status-progress-copy">
                  <div id={ids.ringValue} className="status-ring-value">{snapshot.value}</div>
                  <div
                    id={ids.stageDetail}
                    className={`status-stage-detail${display.showDetail ? "" : " hidden"}`}
                  >
                    {display.detailText}
                  </div>
                </div>
                <SubstageFlow
                  selectedStageKey={selectedForFlow}
                  selectedIsCurrent={display.selectedIsCurrent}
                  snapshot={snapshot}
                  selectedProgress={display.selectedProgress}
                />
                <ProgressBlock renderOptions={renderOptions} />
              </div>
              <StageRetry selectedStageKey={selectedForFlow} action={display.retryAction} />
            </section>

            {showResultActions ? (
              <div className="status-card-footer">
                <ResultActions
                  {...display.primaryActions}
                  onReaderClick={() => services.reader.openReader(snapshot.jobId)}
                />
              </div>
            ) : null}
          </div>
        </div>

        {showHiddenContract ? (
          <div className="hidden">
            <div id="job-id">{snapshot.summary?.fields?.jobId ?? "-"}</div>
            <div id="job-status">{snapshot.summary?.fields?.statusSummary ?? "idle"}</div>
            <div id="job-stage-detail">{snapshot.summary?.fields?.stageDetail ?? "-"}</div>
            <div id="query-job-duration">{snapshot.summary?.fields?.queryFinishedAt ?? "-"}</div>
            <div id="job-finished-at">{snapshot.summary?.fields?.finishedAt ?? "-"}</div>
          </div>
        ) : null}
      </div>
    </StatusCardIdsContext.Provider>
  );
}
