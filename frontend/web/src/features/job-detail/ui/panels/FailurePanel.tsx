import { Clock3, Copy, FileText, Link2, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import {
  useHomeSettingsHub,
  useHomeStatusDetail,
} from "@/ui/context/home-services-context.js";
// 同功能内取真值，不绕主页网关、也不经自己的 index（那会让 ui 依赖本功能 barrel 成环）。
import {
  queueFullTitle,
  retryCountdownSeconds,
} from "../../domain/dialog/failure-recovery.js";
import { FailureStageActions } from "./FailureStageActions.jsx";
import { OcrReceiptBindingDialog } from "../OcrReceiptBindingDialog.jsx";
import { FailureLogDialog } from "../FailureLogDialog.jsx";
import type { OcrReceiptValues } from "../../domain/ocr-ambiguity-recovery.js";
import type { StatusDetailOverview } from "../../domain/status-detail-store.js";
import type { StatusDetailControllerApi } from "../useStatusDetailOverview.js";
import { useRerunAction } from "../useRerunAction.js";
import { STATUS_DETAIL_DIALOG_IDS } from "../../domain/status-detail-dom-ids.js";
import { StatusDetailTabPanel } from "./StatusDetailTabPanel.jsx";

type FailurePanelProps = {
  overview: StatusDetailOverview;
  rerunPending: boolean;
  ocrAmbiguityPending: boolean;
  controller: StatusDetailControllerApi;
  active: boolean;
};

export function FailurePanel({
  overview,
  rerunPending,
  ocrAmbiguityPending,
  controller,
  active,
}: FailurePanelProps) {
  const { dialogStore: statusDetailDialogStore } = useHomeStatusDetail();
  const { dialogStore: settingsHubDialogStore } = useHomeSettingsHub();
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const failure = overview.failure;
  const recovery = overview.failureRecovery;
  const rerun = useRerunAction({ overview, rerunPending, controller });
  // 老快照（store 初值）里没有 stages 字段，这里兜一层，别让面板炸在缺字段上。
  const recoveryStages = Array.isArray(recovery.stages) ? recovery.stages : [];
  const [ocrConfirmOpen, setOcrConfirmOpen] = useState(false);
  const [riskConfirmOpen, setRiskConfirmOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState("");
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const descriptor = overview.ocrAmbiguity.descriptor;
  const canBindReceipt = Boolean(
    descriptor?.allowed_resolutions.includes("bind_existing_receipt"),
  );
  const canAcceptDuplicateRisk = Boolean(
    descriptor?.allowed_resolutions.includes("accept_duplicate_risk"),
  );

  useEffect(() => {
    setOcrConfirmOpen(false);
    setReceiptDialogOpen(false);
    setLogDialogOpen(false);
  }, [overview.ocrAmbiguity.jobId, descriptor?.resolution_revision]);

  useEffect(() => {
    setRecoveryFeedback("");
    setRetryPending(false);
    setCountdownNow(Date.now());
    if (recovery.retryAtMs === null) return undefined;
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [overview.ocrAmbiguity.jobId, recovery.retryAtMs]);

  const retrySeconds = retryCountdownSeconds(recovery, countdownNow);
  // 重试按钮禁用必有理由：后端 disabled_reason 为空时给默认文案，保证 title 可达。
  const retryDisabledReason = retryPending
    ? "正在创建 OCR 恢复任务…"
    : recovery.retryOcr.requiresDuplicateRisk
      ? "需要确认重复风险后重试"
      : (!recovery.retryOcr.enabled
        ? (recovery.retryOcr.reason || "后端当前未开放安全的 OCR 重试操作。")
        : "");
  const retryDisabled = (!recovery.retryOcr.enabled && !recovery.retryOcr.requiresDuplicateRisk) || retryPending;
  const rerunDisabledReason = (rerun.status || "").trim() || "当前任务暂不可从断点恢复。";

  async function confirmOcrRecovery() {
    const outcome = await controller.acceptOcrDuplicateRiskAndRecover?.();
    if (outcome?.ok || outcome?.conflict) setOcrConfirmOpen(false);
  }

  async function bindExistingReceipt(values: OcrReceiptValues) {
    return controller.bindExistingOcrReceiptAndRecover?.(values)
      || { ok: false, conflict: false };
  }

  async function retryOcrImmediately(options: { acceptDuplicateRisk?: boolean } = {}) {
    // 重复风险走二次确认：调用方（queue_full 卡片）在 requiresDuplicateRisk 时
    // 先弹确认框，用户确认后再带 acceptDuplicateRisk 进来。
    if (recovery.retryOcr.requiresDuplicateRisk && !options.acceptDuplicateRisk) {
      setRiskConfirmOpen(true);
      return;
    }
    setRetryPending(true);
    setRecoveryFeedback("正在创建 OCR 恢复任务…");
    try {
      await controller.retryOcrNow?.(options);
    } catch (error) {
      setRecoveryFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      // settled 即清零：成功也恢复可点，不再只靠 jobId 切换的 effect。
      setRetryPending(false);
    }
  }

  async function copyTraceId() {
    setRecoveryFeedback("");
    try {
      await controller.copyFailureTraceId?.();
      setRecoveryFeedback("Trace ID 已复制。");
    } catch (error) {
      setRecoveryFeedback(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openProviderSettings() {
    statusDetailDialogStore?.close?.();
    settingsHubDialogStore?.open?.({ tab: "api" });
  }

  return (
    <StatusDetailTabPanel value="failure" id={ids.panels.failure} active={active}>
      <section className="status-detail-section failure-summary-section">
        <div className="status-detail-section-head">
          <div>
            <h3>问题摘要</h3>
            <p>先看原因，再选择是否恢复任务</p>
          </div>
          <span className="status-detail-state-badge is-failed">失败</span>
        </div>
        <div className="failure-hero-card">
          <span className="label">失败摘要</span>
          <span id={ids.failure.summary} className="info-value">{failure.summary}</span>
          <span id={ids.failure.rootCause} className="status-detail-failure-root-cause">{failure.rootCause}</span>
        </div>

        <div className="status-detail-log-entry-row">
          <button
            id={ids.failure.logButton}
            type="button"
            className="button-link secondary"
            onClick={() => setLogDialogOpen(true)}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            查看错误日志
          </button>
          <span className="status-panel-note">包含错误码、阶段、Trace ID 和最近日志，可一键复制。</span>
        </div>

        <div className="status-detail-failure-recovery">
          {overview.ocrAmbiguity.required ? (
            <div className="failure-action-row status-detail-recovery-actions">
              {canBindReceipt ? (
                <button
                  id={ids.failure.ocrBindButton}
                  type="button"
                  className="button-link secondary"
                  disabled={ocrAmbiguityPending}
                  title={ocrAmbiguityPending ? "正在处理 OCR 恢复…" : undefined}
                  onClick={() => setReceiptDialogOpen(true)}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  绑定已有任务
                </button>
              ) : null}
              {canAcceptDuplicateRisk ? (
                <button
                  id={ids.failure.ocrAmbiguityButton}
                  type="button"
                  className="button-link secondary"
                  disabled={ocrAmbiguityPending}
                  title={ocrAmbiguityPending ? "正在处理 OCR 恢复…" : undefined}
                  onClick={() => setOcrConfirmOpen(true)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  重新提交 OCR
                </button>
              ) : null}
              {!descriptor ? (
                <button type="button" className="button-link secondary" disabled title="后端未返回可操作的 OCR 恢复信息，请刷新诊断。">
                  恢复信息不可用
                </button>
              ) : null}
              <span id={ids.failure.ocrAmbiguityStatus} className="status-panel-note">
                {overview.ocrAmbiguity.status || (
                  descriptor
                    ? `${descriptor.provider === "mineru" ? "MinerU" : "PaddleOCR"} 返回结果不明确，请选择恢复方式。`
                    : "后端未返回可操作的 OCR 恢复信息，请刷新诊断。"
                )}
              </span>
            </div>
          ) : recovery.kind === "queue_full" ? (
            <>
              <div id={ids.failure.queueCard} className="status-detail-failure-queue">
                <div>
                  <strong>{queueFullTitle(recovery)}</strong>
                  <p>{recovery.statusText}</p>
                </div>
                {retrySeconds !== null ? (
                  <span id={ids.failure.queueCountdown} className="status-panel-note" role="status">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    {retrySeconds > 0 ? `预计 ${retrySeconds} 秒后自动重试` : "即将自动重试"}
                  </span>
                ) : null}
                <span id={ids.failure.preservation} className="status-panel-note">
                  {recovery.preservationText}
                </span>
              </div>
              <div className="failure-action-row status-detail-recovery-actions">
                <button
                  id={ids.failure.retryOcrButton}
                  type="button"
                  className="button-link secondary"
                  disabled={retryDisabled}
                  title={retryDisabled ? retryDisabledReason : undefined}
                  onClick={() => void retryOcrImmediately()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {retryPending ? "正在重试…" : "立即重试 OCR"}
                </button>
                <ConfirmDialog
                  id="failure-ocr-risk-confirm"
                  open={riskConfirmOpen}
                  onOpenChange={setRiskConfirmOpen}
                  pending={retryPending}
                  title="确认重试 OCR"
                  description="上游可能已经收到上一次请求。继续会创建新的 OCR 任务，可能造成重复处理或计费。"
                  confirmLabel="确认重试"
                  onConfirm={() => {
                    setRiskConfirmOpen(false);
                    void retryOcrImmediately({ acceptDuplicateRisk: true });
                  }}
                />
                {recovery.traceId ? (
                  <button
                    id={ids.failure.copyTraceButton}
                    type="button"
                    className="button-link secondary"
                    onClick={copyTraceId}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    复制 Trace ID
                  </button>
                ) : null}
                <button
                  id={ids.failure.switchProviderButton}
                  type="button"
                  className="button-link secondary"
                  onClick={openProviderSettings}
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  切换 OCR 服务
                </button>
                <span id={ids.failure.traceFeedback} className="status-panel-note" role="status">
                  {recoveryFeedback || (recovery.traceId ? `Trace ID：${recovery.traceId}` : "")}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* 后端说得出哪些阶段能续跑，就把它们全渲染出来；说不出时才退回
                  通用的「从断点恢复」按钮（老行为）。 */}
              <FailureStageActions
                hint={recovery.statusText}
                stages={recoveryStages}
                retryStage={controller.retryFailureStage}
              />
              <div className="failure-action-row status-detail-recovery-actions">
              <button
                id={ids.failure.rerunButton}
                type="button"
                className="button-link secondary"
                disabled={rerun.disabled}
                title={rerun.disabled ? rerunDisabledReason : undefined}
                onClick={rerun.run}
              >
                从断点恢复/重新运行
              </button>
              <span id={ids.failure.rerunStatus} className="status-panel-note">
                {rerun.status || "失败后如后端允许，可基于已有产物创建恢复任务。"}
              </span>
              </div>
            </>
          )}
        </div>

        <details className="status-detail-technical-details">
          <summary>技术详情</summary>
          <div className="info-list detail-info-list">
            <div className="info-row"><span className="label">分类</span><span id={ids.failure.category} className="info-value mono">{failure.category}</span></div>
            <div className="info-row"><span className="label">阶段</span><span id={ids.failure.stage} className="info-value">{failure.stage}</span></div>
            <div className="info-row"><span className="label">可重试</span><span id={ids.failure.retryable} className="info-value">{failure.retryable}</span></div>
            <div className="info-row status-detail-failure-detail-wide"><span className="label">建议</span><span id={ids.failure.suggestion} className="info-value">{failure.suggestion}</span></div>
            <div className="info-row status-detail-failure-detail-wide"><span className="label">最近日志</span><span id={ids.failure.lastLogLine} className="info-value mono">{failure.lastLogLine}</span></div>
          </div>
        </details>
      </section>

      {descriptor ? (
        <>
          <ConfirmDialog
            id={ids.failure.ocrAmbiguityConfirm}
            open={ocrConfirmOpen}
            onOpenChange={setOcrConfirmOpen}
            pending={ocrAmbiguityPending}
            title="确认重新提交 OCR"
            description={(
              <>
                <span>上游可能已经收到上一次请求。继续会创建新的 OCR 任务，可能造成重复处理或计费。</span>
                {overview.ocrAmbiguity.status ? (
                  <span className="status-panel-note" role="status">{overview.ocrAmbiguity.status}</span>
                ) : null}
              </>
            )}
            confirmLabel="接受风险并重新提交"
            tone="danger"
            onConfirm={confirmOcrRecovery}
          />
          <OcrReceiptBindingDialog
            id={ids.failure.ocrBindDialog}
            descriptor={descriptor}
            open={receiptDialogOpen}
            onOpenChange={setReceiptDialogOpen}
            pending={ocrAmbiguityPending}
            status={overview.ocrAmbiguity.status}
            onSubmit={bindExistingReceipt}
          />
        </>
      ) : null}
      <FailureLogDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        jobId={overview.headline.jobId}
        logText={failure.logText}
      />
    </StatusDetailTabPanel>
  );
}
