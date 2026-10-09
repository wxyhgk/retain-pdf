import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { CurrentJobStatePort } from "./current-job-state.js";
/**
 * 阶段重试：解析当前任务快照里的书目元数据，调用重试接口，
 * 成功后以 seedPayload 静默重启轮询（详情 Tab 内重试），否则回拉一次当前任务。
 */

/**
 * 从 statusCard snapshot 提取书目元数据。
 * snapshot 顶层无 document_id；身份可能在 job / raw_response 里，逐层回落。
 */
export function resolveRetryBookMeta(prevSnapshot: Record<string, unknown> = {}) {
  const prevJob = (
    (prevSnapshot.job && typeof prevSnapshot.job === "object" ? prevSnapshot.job : null)
    || prevSnapshot
  ) as Record<string, unknown>;
  const prevRaw = (
    (prevJob.raw_response && typeof prevJob.raw_response === "object" ? prevJob.raw_response : null)
    || prevJob
  ) as Record<string, unknown>;
  const pickBook = (...keys: string[]) => {
    for (const key of keys) {
      for (const source of [prevSnapshot, prevJob, prevRaw]) {
        const value = `${source?.[key] ?? ""}`.trim();
        if (value) return value;
      }
    }
    return "";
  };
  return {
    document_id: pickBook("document_id"),
    title: pickBook("title", "display_name"),
    display_name: pickBook("display_name", "title"),
    page_count: prevSnapshot.page_count ?? prevJob.page_count ?? prevRaw.page_count,
    cover_url: pickBook("cover_url"),
    thumbnail_url: pickBook("thumbnail_url"),
  };
}

/** 阶段重试依赖：重试接口 / 当前任务端口 / 轮询与回拉 / 文案 / 归一化 */
export interface RetryStageDeps {
  retryJobStage: (
    jobId: string,
    apiPrefix: string | undefined,
    stage: string,
    bookMeta: ReturnType<typeof resolveRetryBookMeta>,
  ) => Promise<JobLike>;
  apiPrefix?: string;
  currentJobPort: CurrentJobStatePort;
  startPolling: (
    jobId: string,
    options: {
      silent?: boolean;
      showWorkflow?: boolean;
      publishLibrary?: boolean;
      seedPayload?: Record<string, unknown>;
    },
  ) => void;
  fetchJob: (jobId: string) => Promise<unknown>;
  setText: (id: string, message: string) => void;
  normalizeJobPayload: (value: unknown) => JobPayload;
}

export function createRetryStage({
  retryJobStage,
  apiPrefix,
  currentJobPort,
  startPolling,
  fetchJob,
  setText,
  normalizeJobPayload,
}: RetryStageDeps) {
  // 口径说明：本执行器不复核 canRetry（按钮层 StageRetry / TranslationStageActions
  // 已按 can_retry 直显禁用；status-card/retry.ts:78 的 `canRetry || failed || succeeded`
  // 只决定是否返回按钮配置）。缺 job/stage 时给明确理由，不静默吞错。
  return async function retryStage(stage: string, options: { jobId?: string } = {}) {
    const normalizedStage = `${stage || ""}`.trim();
    // 优先事件带的 jobId → 当前轮询 → 上次 snapshot（详情卡上点重试时可能尚未 currentJobId）
    const jobId = `${
      options.jobId
      || currentJobPort.jobId()
      || currentJobPort.snapshot?.()?.job_id
      || ""
    }`.trim();
    if (!jobId || !normalizedStage) {
      setText("error-box", "当前没有可重新执行的阶段");
      return;
    }
    try {
      setText("error-box", "-");
      const prevSnapshot = (currentJobPort.snapshot?.() || {}) as Record<string, unknown>;
      const bookMeta = resolveRetryBookMeta(prevSnapshot);
      const result = await retryJobStage(jobId, apiPrefix, normalizedStage, bookMeta);
      const nextJobId = `${result?.job_id || jobId}`.trim();
      if (nextJobId) {
        // 进度字段用 result；书目元数据优先 bookMeta（避免 Mock 重试标题盖掉书名）
        const seed = normalizeJobPayload({
          ...result,
          job_id: nextJobId,
          source_job_id: jobId,
          document_id: result?.document_id || bookMeta.document_id,
          title: bookMeta.title || result?.title,
          display_name: bookMeta.display_name || bookMeta.title || result?.display_name,
          cover_url: bookMeta.cover_url || result?.cover_url,
          thumbnail_url: bookMeta.thumbnail_url || result?.thumbnail_url,
          page_count: bookMeta.page_count ?? result?.page_count,
          library_only: false,
          active_job_id: nextJobId,
        });
        // 详情 Tab 内重试：silent + 首帧用 fromStage 结果；必须带 document_id/source_job_id
        startPolling(nextJobId, {
          silent: true,
          showWorkflow: false,
          publishLibrary: false,
          seedPayload: {
            ...seed,
            source_job_id: jobId,
            document_id: seed.document_id || bookMeta.document_id,
            title: seed.title || bookMeta.title,
            display_name: seed.display_name || bookMeta.display_name || bookMeta.title,
            cover_url: seed.cover_url || bookMeta.cover_url,
            thumbnail_url: seed.thumbnail_url || bookMeta.thumbnail_url,
            status: seed.status && seed.status !== "succeeded" ? seed.status : "running",
          },
        });
        // startPolling 已 notify 一帧 running，此处不必重复
      } else {
        await fetchJob(jobId);
      }
    } catch (err) {
      setText("error-box", err.message || String(err));
    }
  };
}
