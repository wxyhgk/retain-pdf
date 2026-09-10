// idle 首帧：把主页外壳（进度条 / 摘要 / 上传区 / 工作流）打回空态。
//
// 原在 src/js/features/app-shell/idle-reset.ts + config-port.ts。按归属拆分后：
//   - 外壳这半（本文件）落 app/home/composition —— 它读的是 bridge 回调，
//     唯一消费方是同目录的 create-lifecycle.ts 的 initializeIdleView()。
//   - 状态详情弹窗那半（resetStatusDetailRuntimeView，重置的 18 个 DOM id 全在
//     features/job-detail 的 status-detail-dom-ids.ts 里）留在 job-detail 功能内，
//     这里跨功能经它的出口 @/features/job-detail/index.js 取。
//
// createAppShellConfigPort 一并搬来同住：它存在的唯一目的就是把 isMock 喂给
// initializeIdleAppView（mock 模式下才清 error-box），没有第二个消费方。

import { isMockMode } from "@/platform/config/runtime.js";
import { resetStatusDetailRuntimeView } from "@/features/job-detail/index.js";

export function createAppShellConfigPort({
  isMock = isMockMode,
}: any = {}) {
  return {
    isMock,
  };
}

export const defaultAppShellConfigPort = createAppShellConfigPort();

export function initializeIdleAppView({
  configPort,
  jobPresentationPort = {},
  setText,
  setWorkflowSections,
  setLinearProgress,
  updateActionButtons,
  renderPageRangeSummary,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  updateJobWarning,
  resetEventsList,
  activateDetailTab,
}: any) {
  const normalizeJobPayload = jobPresentationPort.normalizeJobPayload || ((payload) => payload);
  const summarizeStatus = jobPresentationPort.summarizeStatus || ((status) => status);

  updateActionButtons(normalizeJobPayload({}));
  setWorkflowSections(null);
  setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
  setText("job-summary", summarizeStatus("idle"));
  setText("job-stage-detail", "-");
  setText("query-job-duration", "-");
  resetStatusDetailRuntimeView({ setText, resetEventsList, activateDetailTab });
  if (configPort?.isMock?.()) {
    setText("error-box", "-");
  }
  renderPageRangeSummary();
  resetUploadProgress();
  resetUploadedFile();
  applyWorkflowMode();
  updateJobWarning("idle");
}
