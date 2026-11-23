/** 按需取一次完整错误（含 traceback）。
 *
 * 列表每 2 秒轮询一次，所以 traceback 不进列表（后端那边只给精简版）。用户点
 * 「展开完整错误」时才走这里打一次 job 详情端点 —— 那个端点本来就带完整的
 * `failure`、`error` 和 `log_tail`。
 *
 * `fetchJobPayload` 自带 in-flight 去重，重复点击不会打出多个请求。
 */
import { fetchJobPayload } from "@/platform/api/index.js";

type JobDetailPayload = {
  error?: unknown;
  log_tail?: unknown;
  failure?: {
    raw_excerpt?: unknown;
    last_log_line?: unknown;
    raw_diagnostic?: { traceback?: unknown };
    failure_code?: unknown;
    code?: unknown;
    failed_stage?: unknown;
    provider?: unknown;
    provider_code?: unknown;
    upstream_host?: unknown;
    recovery_hint?: unknown;
  };
  request_payload?: {
    ocr?: { provider?: unknown };
    translation?: { model?: unknown; base_url?: unknown; api_protocol?: unknown };
  };
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** 把详情里几处错误信息拼成一段可读文本。
 *
 * 顺序是「最具体的在最上面」：traceback > error > raw_excerpt > log_tail。
 * 只取第一个非空的那类，不全堆上去 —— 它们之间大量重复（实测 raw_excerpt、
 * last_log_line、raw_error_excerpt 常常是同一句话）。
 */
export function pickFailureDetailText(payload: unknown): string {
  const detail = (payload as { data?: JobDetailPayload })?.data
    ?? (payload as JobDetailPayload);
  if (!detail) return "";
  const traceback = text(detail.failure?.raw_diagnostic?.traceback);
  if (traceback) return traceback;
  const error = text(detail.error);
  if (error) return error;
  const excerpt = text(detail.failure?.raw_excerpt) || text(detail.failure?.last_log_line);
  if (excerpt) return excerpt;
  const logTail = detail.log_tail;
  if (Array.isArray(logTail)) return logTail.map(text).filter(Boolean).join("\n");
  return text(logTail);
}

export async function loadJobFailureDetail(jobId: string): Promise<string> {
  return pickFailureDetailText(await fetchJobPayload(jobId));
}

/** 复制诊断信息时附上的线索：失败码、上游的码和地址、这次用的 OCR 和翻译模型。只取这些，不碰 Key。 */
export type JobFailureFacts = {
  failureCode: string;
  failedStage: string;
  provider: string;
  providerCode: string;
  upstreamHost: string;
  recoveryHint: string;
  ocrProvider: string;
  translationModel: string;
  /** 翻译接口只留主机名：地址里可能带路径、查询串，没必要整段贴出去。 */
  translationHost: string;
  detail: string;
};

function hostOf(value: unknown): string {
  try {
    return new URL(text(value)).host;
  } catch {
    return "";
  }
}

export function pickFailureFacts(payload: unknown): JobFailureFacts {
  const detail = ((payload as { data?: JobDetailPayload })?.data ?? (payload as JobDetailPayload)) || {};
  const failure = detail.failure || {};
  const request = detail.request_payload || {};
  return {
    failureCode: text(failure.failure_code) || text(failure.code),
    failedStage: text(failure.failed_stage),
    provider: text(failure.provider),
    providerCode: text(failure.provider_code),
    upstreamHost: text(failure.upstream_host),
    recoveryHint: text(failure.recovery_hint),
    ocrProvider: text(request.ocr?.provider),
    translationModel: text(request.translation?.model),
    translationHost: hostOf(request.translation?.base_url),
    detail: pickFailureDetailText(payload),
  };
}

export async function loadJobFailureFacts(jobId: string): Promise<JobFailureFacts> {
  return pickFailureFacts(await fetchJobPayload(jobId));
}
