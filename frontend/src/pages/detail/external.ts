// Điểm xuất duy nhất từ pages/detail sang src/js/*.
// DetailApp / components bị cấm import trực tiếp ../../js/**; thiếu symbol thì chỉ sửa file này.

// -- job --
export { normalizeJobPayload } from "../../js/job/normalize.js";
export { isJobTerminal } from "../../js/job/core.js";
export {
  formatEventTimestamp,
  formatRuntimeDuration,
} from "../../js/job/formatters.js";
export { stageHistoryDisplay } from "../../js/job/stage-history.js";

// -- job-detail --
export { getJobIdFromQuery } from "../../js/job-detail/routing.js";
export { defaultJobDetailConfigPort } from "../../js/job-detail/config-port.js";
export { defaultJobDetailDataPort } from "../../js/job-detail/data-port.js";
export { defaultJobDetailResumePort } from "../../js/job-detail/resume-port.js";
export { bindRerunButton } from "../../js/job-detail/resume.js";
export { renderJobDetailOverview } from "../../js/job-detail/overview-renderer.js";
export { loadAndRenderMarkdownFlow } from "../../js/job-detail/markdown-flow.js";
export {
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
} from "../../js/job-detail/page-state.js";
export { buildJobDetailEventViewModel } from "../../js/job-detail/status-view-model.js";

// -- downloads --
export {
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
} from "../../js/utils/downloads.js";
export {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "../../js/utils/download-feedback.js";
