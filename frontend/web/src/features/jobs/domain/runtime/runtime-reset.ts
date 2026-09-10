import { resetStatusDetailRuntimeView } from "@/features/job-detail/index.js";
import { clearActiveJobId } from "./active-job-storage.js";
import { createJobRuntimeShellViewPort } from "./shell-view-port.js";
import { createJobRuntimeResetStatePort } from "./reset-state-port.js";
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
  setText,
  updateJobWarning,
  activateDetailTab,
  uploadStatePort,
  resetStatePort,
  shellViewPort = createJobRuntimeShellViewPort(),
  jobPresentationPort = {},
}: any) {
  const summarizeStatus = jobPresentationPort.summarizeStatus || ((status) => status);
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
  setText("job-summary", summarizeStatus("idle"));
  setText("job-stage-detail", "-");
  setText("job-id", "-");
  setText("query-job-duration", "-");
  setText("job-finished-at", "-");
  clearPageRanges();
  resetStatusDetailRuntimeView({
    setText,
    resetEventsList: shellViewPort.resetEvents,
    activateDetailTab,
  });
  updateJobWarning("idle");
}
