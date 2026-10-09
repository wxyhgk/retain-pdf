import { defaultJobDetailDataPort } from "./data-port.js";

/** 恢复端口依赖：重跑（按动作 URL）与断点续跑（按 job_id）两条接口 */
export interface JobDetailResumePortDeps {
  apiPrefix?: string;
  rerunJob?: (actionUrl: string) => Promise<unknown>;
  resumeJob?: (jobId: string, apiPrefix: string) => Promise<unknown>;
}

export interface JobDetailResumeSubmitOptions {
  actionUrl?: string;
  jobId?: string;
}

export function createJobDetailResumePort({
  apiPrefix = "",
  rerunJob,
  resumeJob,
}: JobDetailResumePortDeps = {}) {
  return {
    async submit({ actionUrl = "", jobId = "" }: JobDetailResumeSubmitOptions = {}) {
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
