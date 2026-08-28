import { resolveRecoverableJobId } from "./active-job-recovery.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";
import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsNavigationPort } from "./navigation-port.js";

export function createRecentJobActions({
  apiPrefix,
  deleteLibraryBook,
  startPolling,
  openReader,
  currentJobId = () => "",
  jobRuntimePort = createRecentJobsRuntimePort({
    openJob: startPolling,
    currentJobId,
  }),
  readerPort = createRecentJobsReaderPort({
    openReader,
  }),
  closeRecentJobsDialog,
  activeJobRecoveryPort,
  navigationPort = createRecentJobsNavigationPort({
    closeDialog: closeRecentJobsDialog,
    currentJobId,
    jobRuntimePort,
    readerPort,
  }),
  renderCurrentRecentJobs,
  renderRecentJobsEmpty,
  renderRecentJobsError,
  statePort,
}: any) {
  let activeJobRecoveryAttempted = false;

  function selectJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      renderRecentJobsError("Tác vụ này thiếu job_id nên không thể mở.", { reset: false });
      return;
    }
    navigationPort.openJob(normalizedJobId);
  }

  // 409 = bảo vệ xóa: job đang được mục yêu thích tham chiếu, không tự force; người dùng phải xử lý mục yêu thích trước.
  function friendlyDeleteError(error) {
    const message = `${error?.message || error || ""}`;
    if (error?.status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
        ? `Tài liệu này có ${count} mục yêu thích. Vui lòng xóa mục yêu thích trước khi xóa tài liệu.`
        : "Tài liệu này đang được mục yêu thích tham chiếu. Vui lòng xóa các mục yêu thích liên quan trước khi xóa tài liệu.";
    }
    return message || "Xóa thất bại";
  }

  async function deleteJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId || !deleteLibraryBook) {
      return;
    }
    try {
      await deleteLibraryBook(apiPrefix, normalizedJobId);
    } catch (error) {
      renderRecentJobsError(friendlyDeleteError(error), { reset: false });
      return;
    }
    statePort.removeJobFamily(normalizedJobId);
    const nextItems = statePort.getSnapshot().items;
    if (nextItems.length === 0) {
      renderRecentJobsEmpty("Chưa có tác vụ gần đây");
      return;
    }
    renderCurrentRecentJobs({ reset: true });
  }

  function openJobReader(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      renderRecentJobsError("Tác vụ này thiếu job_id nên không thể mở chế độ đọc đối chiếu.", { reset: false });
      return;
    }
    navigationPort.openReader(normalizedJobId);
  }

  function recoverActiveJob(items = []) {
    if (activeJobRecoveryAttempted) {
      return;
    }
    if (navigationPort.currentJobId()) {
      activeJobRecoveryAttempted = true;
      return;
    }
    activeJobRecoveryAttempted = true;
    const jobId = resolveRecoverableJobId(items, activeJobRecoveryPort);
    if (!jobId) {
      return;
    }
    navigationPort.recoverJob(jobId);
  }

  return {
    deleteJob,
    openJobReader,
    recoverActiveJob,
    selectJob,
  };
}
