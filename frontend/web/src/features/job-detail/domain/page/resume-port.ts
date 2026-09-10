import { defaultJobDetailDataPort } from "./data-port.js";

export function createJobDetailResumePort({
  apiPrefix = "",
  rerunJob,
  resumeJob,
}: any = {}) {
  return {
    async submit({ actionUrl = "", jobId = "" }: any = {}) {
      const resolvedJobId = `${jobId || ""}`.trim();
      if (resolvedJobId) {
        return resumeJob(resolvedJobId, apiPrefix);
      }
      return rerunJob(`${actionUrl || ""}`.trim());
    },
  };
}

export const defaultJobDetailResumePort = createJobDetailResumePort({
  apiPrefix: defaultJobDetailDataPort.apiPrefix,
  rerunJob: defaultJobDetailDataPort.rerunJob,
  resumeJob: defaultJobDetailDataPort.resumeJob,
});
