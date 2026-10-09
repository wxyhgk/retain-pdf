import { clearActiveJobId } from "./active-job-storage.js";
import { createJobRuntimeShellViewPort } from "./shell-view-port.js";
import { createJobRuntimeResetStatePort, type JobRuntimeResetTarget } from "./reset-state-port.js";
import {
  currentJobId,
} from "./current-job-state.js";
import {
  stopPolling,
} from "./runtime-polling-state.js";

export function returnJobRuntimeToHome({
  state,
  onReaderDialogClose,
  setWorkflowSections,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  clearPageRanges,
  updateJobWarning,
  activateDetailTab,
  uploadStatePort,
  resetStatePort,
  shellViewPort = createJobRuntimeShellViewPort(),
}: {
  state: JobRuntimeResetTarget;
  onReaderDialogClose?: () => void;
  setWorkflowSections: (job: unknown) => void;
  resetUploadProgress: () => void;
  resetUploadedFile: () => void;
  applyWorkflowMode: (mode?: string) => void;
  clearPageRanges: () => void;
  updateJobWarning: (warning: string) => void;
  activateDetailTab?: (tab: string) => void;
  uploadStatePort?: { clearAppliedPageRange?: () => void } | null;
  resetStatePort?: ReturnType<typeof createJobRuntimeResetStatePort>;
  shellViewPort?: ReturnType<typeof createJobRuntimeShellViewPort>;
}) {
  const resetState = resetStatePort || createJobRuntimeResetStatePort(state);
  clearActiveJobId(currentJobId(state));
  stopPolling(state);
  shellViewPort.closeDialogs();
  onReaderDialogClose?.();
  resetState.resetJob();
  if (uploadStatePort?.clearAppliedPageRange) {
    uploadStatePort.clearAppliedPageRange();
  } else {
    resetState.clearAppliedPageRange?.();
  }
  setWorkflowSections(null);
  resetUploadProgress();
  resetUploadedFile();
  applyWorkflowMode();
  clearPageRanges();
  // 以前这里还往文字仓库写首页旧状态卡的 5 个字段、状态详情弹窗的 18 个字段，
  // 都没人读（旧状态卡已下线，弹窗由自己的 store 渲染）。弹窗只需要回到概览页。
  activateDetailTab?.("overview");
  updateJobWarning("idle");
}
