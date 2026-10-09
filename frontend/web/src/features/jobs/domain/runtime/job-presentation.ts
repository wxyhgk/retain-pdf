import { isTerminalStatus as isDomainTerminalStatus } from "@retainpdf/domain/job";
import type { JobLike, JobPayload, JobStatus } from "@retainpdf/domain/job";

/** 展示谓词端口（composition 注入；缺省回落到内置实现） */
export interface JobPresentationPort {
  normalizeJobPayload?: (value: unknown) => JobPayload;
  isTerminalStatus?: (status: JobStatus | string | null | undefined) => boolean;
  isJobTerminal?: (value?: JobLike | JobStatus | string | null) => boolean;
  buildJobPatchWithDisplayState?: (job: JobLike) => JobLike;
}

/**
 * 任务展示谓词的装配：从 composition 注入的 jobPresentationPort 取
 * normalizeJobPayload / isTerminalStatus / isJobTerminal，缺失时回落到内置默认实现。
 * 这些谓词被轮询引擎与重试动作共用，集中一处便于注入与单测。
 */
export function createJobPresentation({ jobPresentationPort }: { jobPresentationPort?: JobPresentationPort } = {}) {
  const normalizeJobPayload =
    jobPresentationPort?.normalizeJobPayload || ((value: unknown) => (value || {}) as JobPayload);
  // 默认回退只把「硬失败/取消」当终态（成功需等 port 侧带完成信号判定），
  // 复用 domain 真值再排除 succeeded，语义与旧的 failed/canceled 完全一致。
  const isTerminalStatus =
    jobPresentationPort?.isTerminalStatus ||
    ((status: JobStatus | string | null | undefined) => isDomainTerminalStatus(status) && status !== "succeeded");
  const isJobTerminal =
    jobPresentationPort?.isJobTerminal ||
    ((value: JobLike | JobStatus | string | null | undefined = {}) => isTerminalStatus(
      (value as JobLike | null | undefined)?.status || (value as JobStatus | string | null | undefined),
    ));
  return { normalizeJobPayload, isTerminalStatus, isJobTerminal };
}
