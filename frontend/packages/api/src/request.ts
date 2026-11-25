// 生成的请求函数（src/generated/）共用的传输层：拼地址和查询串、带 key、发 JSON、拆 {code, data} 信封。
// 给用户看的报错文案不在这里定——各领域的手写函数通过 onError 传进来，生成层只负责把失败的
// 状态码和后端回的错误体交出去。方案见 docs/ops/planning/api-client-codegen/。

import { apiFetch, buildApiHeaders, buildApiUrl, unwrapEnvelope } from "./internal/runtime.js";
import { attachErrorDetails, attachRequestRef, explainLegacyJob, refusedSubmissionError, type HttpError } from "./http.js";
import { IDEMPOTENCY_KEY_HEADER } from "./idempotency.js";

export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;

export interface RequestOptions {
  signal?: AbortSignal;
  /** 换掉发请求的函数（测试或调用方自带的 fetch）；默认 apiFetch。 */
  fetchImpl?: typeof fetch;
  /** 把失败的响应变成错误对象；不传时用后端的 message 加状态码，并挂上 errorCode、reason。 */
  onError?: (status: number, payload: any) => Error;
  /** 建任务类请求带的 Idempotency-Key（见 idempotency.ts）；不传就不带这个头。 */
  idempotencyKey?: string;
}

export interface RequestSpec {
  apiPrefix: string | undefined;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** 相对 /api/v1 的路径，路径参数已经编码。 */
  path: string;
  query?: object;
  body?: unknown;
  options?: RequestOptions;
}

/** 查询参数按传入顺序编码：undefined、null、空串不发；数组按后端约定用逗号连接（job_ids=a,b）。 */
export function encodeQuery(query: object | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query as Record<string, QueryValue>)) {
    if (raw === undefined || raw === null) continue;
    const value = Array.isArray(raw) ? raw.join(",") : `${raw}`;
    if (value === "") continue;
    params.set(key, value);
  }
  return params.toString();
}

export function encodePathParam(value: string): string {
  return encodeURIComponent(`${value ?? ""}`);
}

export async function request<T>({ apiPrefix, method, path, query, body, options = {} }: RequestSpec): Promise<T> {
  const search = encodeQuery(query);
  const url = `${buildApiUrl(apiPrefix, path)}${search ? `?${search}` : ""}`;
  // GET 不带 Content-Type：它不在 CORS 安全列表里，会把每个 GET 都变成预检请求。
  const extraHeaders: Record<string, string> = options.idempotencyKey
    ? { [IDEMPOTENCY_KEY_HEADER]: options.idempotencyKey }
    : {};
  const init: RequestInit = body === undefined
    ? { headers: buildApiHeaders(extraHeaders) }
    : { headers: { ...buildApiHeaders(extraHeaders), "Content-Type": "application/json" }, body: JSON.stringify(body) };
  if (method !== "GET") init.method = method;
  if (options.signal) init.signal = options.signal;
  const resp = await (options.fetchImpl || apiFetch)(url, init);
  if (!resp.ok) {
    const payload: any = await resp.json().catch(() => null);
    const error = explainLegacyJob(
      (options.onError || failWithDetails("请求失败，请稍后重试。"))(resp.status, payload) as HttpError,
      payload,
    );
    if (error.url === undefined) error.url = url;
    throw attachRequestRef(error, resp, payload);
  }
  return unwrapEnvelope<T>(await resp.json());
}

function withStatus(error: Error, status: number): HttpError {
  return Object.assign(error, { status }) as HttpError;
}

// 下面几种 onError 造出来的错误都带 status，调用方可以按状态码兜底（见 orOnStatus）。

/** 只用固定文案加状态码，例如「读取文档库失败，请稍后重试。(500)」。 */
export function failWith(message: string): NonNullable<RequestOptions["onError"]> {
  return (status) => withStatus(new Error(`${message}(${status})`), status);
}

/** 优先用后端回的 message，没有时用固定文案，都加状态码。 */
export function failWithServerMessage(fallback: string): NonNullable<RequestOptions["onError"]> {
  return (status, payload) => withStatus(new Error(`${payload?.message || fallback}(${status})`), status);
}

/** 有后端的 message 就原样用（不加状态码），没有时用固定文案加状态码。 */
export function serverMessageOr(fallback: string): NonNullable<RequestOptions["onError"]> {
  return (status, payload) => withStatus(new Error(payload?.message || `${fallback}(${status})`), status);
}

/** 同 failWithServerMessage，再挂上后端错误里的 errorCode、reason（409 靠 reason 说明为什么不允许）。 */
export function failWithDetails(fallback: string): NonNullable<RequestOptions["onError"]> {
  return (status, payload) => attachErrorDetails(
    withStatus(new Error(`${typeof payload?.message === "string" && payload.message ? payload.message : fallback}(${status})`), status),
    payload,
  );
}

/**
 * 和 submitJson 一样的提交报错：页数额度不够、磁盘空间不够给一句中文（refusedSubmissionError），
 * 其余是「提交失败: 状态码 后端 message」加 context，挂上 errorCode、reason。
 */
export function submitFailure(context = ""): NonNullable<RequestOptions["onError"]> {
  return (status, payload) => {
    const refused = refusedSubmissionError(status, payload);
    if (refused) return refused;
    const detail = payload ? ` ${payload.message || JSON.stringify(payload)}` : "";
    return attachErrorDetails(withStatus(new Error(`提交失败: ${status}${detail}${context}`), status), payload);
  };
}

/** 失败的状态码是 status 时返回 fallback（例如 404 当作「还没有」），别的错误照抛。 */
export async function orOnStatus<T, F>(pending: Promise<T>, status: number, fallback: F): Promise<T | F> {
  try {
    return await pending;
  } catch (error) {
    if ((error as HttpError | null)?.status === status) return fallback;
    throw error;
  }
}
