import type { JobLike } from "@retainpdf/domain/job";
import type { CurrentJobStatePort } from "./current-job-state.js";

/**
 * 取消当前任务：按 workflow 路由到 OCR / 通用取消接口，
 * 请求期间锁取消按钮，失败解锁，成功保持锁定直到权威状态变为 canceled。
 * fetch 回包增加超时兜底：N 秒无权威回包则恢复可点并提示，避免 fetch hang
 * 导致“取消中”永久锁定。
 */

// 权威回包等待上限：超时后解禁取消按钮，由用户决定是否重试取消。
export const CANCEL_FETCH_TIMEOUT_MS = 8000;

function describeCancelError(cause: unknown): string {
  const message = `${(cause as Error)?.message || cause || ""}`.trim();
  const base = message || "取消请求失败";
  const punctuated = /[。！？!?.]$/.test(base) ? base : `${base}。`;
  return `${punctuated}可重试取消，或去详情页确认任务状态。`;
}

/** 取消任务依赖：当前任务端口 / 取消按钮端口 / 两条取消接口 / 回拉 */
export interface CancelCurrentJobDeps {
  currentJobPort: CurrentJobStatePort;
  shellViewPort: { setCancelDisabled: (disabled: boolean) => void };
  setText: (id: string, message: string) => void;
  cancelJob?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  cancelOcrJob?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  apiPrefix?: string;
  fetchJob?: (jobId: string) => Promise<unknown>;
  cancelFetchTimeoutMs?: number;
}

export function createCancelCurrentJob({
  currentJobPort,
  shellViewPort,
  setText,
  cancelJob,
  cancelOcrJob,
  apiPrefix,
  fetchJob,
  cancelFetchTimeoutMs = CANCEL_FETCH_TIMEOUT_MS,
}: CancelCurrentJobDeps) {
  return async function cancelCurrentJob() {
    const jobId = currentJobPort.jobId();
    if (!jobId) {
      setText("error-box", "当前没有可取消的任务");
      return;
    }
    shellViewPort.setCancelDisabled(true);
    try {
      const snapshot: JobLike = currentJobPort.snapshot?.() || {};
      const job = (snapshot?.job && typeof snapshot.job === "object" ? snapshot.job : snapshot) as JobLike;
      const raw = (job?.raw_response && typeof job.raw_response === "object" ? job.raw_response : job) as JobLike;
      const workflow = `${snapshot?.workflow || job?.workflow || raw?.workflow || ""}`.trim();
      const cancel = workflow === "ocr" ? cancelOcrJob : cancelJob;
      if (typeof cancel !== "function") {
        throw new Error("任务取消接口未注入");
      }
      await cancel(jobId, apiPrefix);
      if (typeof fetchJob !== "function") return;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          fetchJob(jobId),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              const timeoutError = new Error(
                `取消请求已发送，但 ${Math.round(cancelFetchTimeoutMs / 1000)} 秒内未收到权威状态回包。`,
              );
              timeoutError.name = "CancelFetchTimeoutError";
              reject(timeoutError);
            }, cancelFetchTimeoutMs);
            // 注意：此处不 unref——fetch hang 时兜底定时器是唯一的恢复手段，
            // unref 会让它在 Node 环境下永不触发，按钮永久锁定。
          }),
        ]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    } catch (err) {
      // 请求失败/权威回包超时都允许用户重试；成功时保持锁定，直到权威状态变为 canceled。
      shellViewPort.setCancelDisabled(false);
      const message = describeCancelError(err);
      if (err?.name === "CancelFetchTimeoutError") {
        setText("error-box", `${message}若任务仍在运行，可重试取消。`);
      } else {
        setText("error-box", message);
      }
    }
  };
}
