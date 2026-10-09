import type { JobLike } from "@retainpdf/domain/job";

/**
 * 轮询帧的纯辅助函数：占位首帧构造与书架发布键/发布判定。
 * 无副作用，可直接 import 单测。
 */

/** 组占位首帧（startPolling 用）：重试时强制 running，避免仍显示「已翻译」不转圈。 */
export function buildPlaceholderJob(jobId: string, startedAt: string, seed: Record<string, unknown> | null) {
  return seed
    ? {
        ...seed,
        job_id: jobId,
        status: seed.status && seed.status !== "succeeded" ? seed.status : "running",
        library_only: false,
        created_at: seed.created_at || startedAt,
        started_at: seed.started_at || startedAt,
      }
    : {
        job_id: jobId,
        status: "queued",
        stage: "queued",
        display_stage: "ocr",
        lane: "main",
        current_stage: "queued",
        stage_detail: "正在读取任务状态...",
        created_at: startedAt,
        started_at: startedAt,
      };
}

/** 书架发布键：job_id | status | stage，用于 silent 模式跳过同态重复 notify。 */
export function libraryPublishKeyOf(job: JobLike = {}) {
  const status = `${job?.status || ""}`.trim();
  const stage = `${job?.display_stage || job?.stage || ""}`.trim();
  return `${job?.job_id || ""}|${status}|${stage}`;
}

/**
 * 是否应推书架：全量 publish 每次都推；silent 仅 status/stage 变化或终态
 * （封面转圈要靠 status=running）。
 */
export function shouldPublishLibrary(
  publishLibrary: boolean,
  terminal: boolean,
  publishKey: string,
  lastPublishKey: string,
): boolean {
  return publishLibrary || terminal || publishKey !== lastPublishKey;
}
