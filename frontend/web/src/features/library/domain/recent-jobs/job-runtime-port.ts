export function createRecentJobsRuntimePort({
  openJob,
  /** 冷启动恢复活跃任务：默认 silent，不抬工作流区 */
  recoverJob,
  currentJobId = () => "",
}: any = {}) {
  function normalizeAndRun(handler, jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return false;
    }
    handler?.(normalizedJobId);
    return true;
  }

  return {
    currentJobId() {
      return `${currentJobId?.() || ""}`.trim();
    },

    openJob(jobId) {
      return normalizeAndRun(openJob, jobId);
    },

    recoverJob(jobId) {
      const handler = recoverJob || openJob;
      return normalizeAndRun(handler, jobId);
    },
  };
}
