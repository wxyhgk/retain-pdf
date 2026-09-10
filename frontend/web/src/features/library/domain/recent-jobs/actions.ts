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
      renderRecentJobsError("该任务缺少 job_id，无法打开。", { reset: false });
      return;
    }
    navigationPort.openJob(normalizedJobId);
  }

  // 409 = 删除保护:该 job 被收藏引用,不能自动 force,必须让用户先处理收藏
  function friendlyDeleteError(error) {
    const message = `${error?.message || error || ""}`;
    if (error?.status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
        ? `该文档有 ${count} 条收藏，请先删除收藏后再删除文档。`
        : "该文档存在收藏引用，请先删除相关收藏后再删除文档。";
    }
    return message || "删除失败";
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
      renderRecentJobsEmpty("暂无最近任务");
      return;
    }
    renderCurrentRecentJobs({ reset: true });
  }

  function openJobReader(jobId, documentId = "") {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      renderRecentJobsError("该任务缺少 job_id，无法打开对照阅读。", { reset: false });
      return;
    }
    navigationPort.openReader(normalizedJobId, `${documentId || ""}`.trim());
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
