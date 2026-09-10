export function createRecentJobsReaderPort({
  openReader,
}: any = {}) {
  return {
    openReader(jobId, anchor = null, documentId = "") {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      openReader?.(normalizedJobId, anchor, `${documentId || ""}`.trim());
      return true;
    },
  };
}
