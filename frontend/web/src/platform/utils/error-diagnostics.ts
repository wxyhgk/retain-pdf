import { APP_VERSION } from "../generated/app-version.js";

function cleanText(value: unknown) {
  return `${value ?? ""}`.trim();
}

function cleanStack(value: unknown) {
  return cleanText(value).split("\n").slice(0, 8).join("\n");
}

/** 报错对象上可能挂着的诊断字段（都是可选的，读取前需要收窄）。 */
type ErrorLike = {
  message?: unknown;
  statusText?: unknown;
  status?: unknown;
  statusCode?: unknown;
  httpStatus?: unknown;
  url?: unknown;
  jobId?: unknown;
  stack?: unknown;
} | null;

function inferErrorMessage(error: unknown) {
  if (!error) {
    return "未知错误";
  }
  if (typeof error === "string") {
    return error;
  }
  // catch 拿到的是 unknown：这里按可选字段读取，和原来的动态属性访问行为一致。
  const errorLike = error as ErrorLike;
  return cleanText(errorLike?.message) || cleanText(errorLike?.statusText) || String(error);
}

function inferHttpStatus(error: unknown, context: ErrorDiagnosticContext) {
  const errorLike = error as ErrorLike;
  const status = context?.status ?? errorLike?.status ?? errorLike?.statusCode ?? errorLike?.httpStatus;
  return status === undefined || status === null || status === "" ? "" : `${status}`;
}

function inferUrl(error: unknown, context: ErrorDiagnosticContext) {
  const errorLike = error as ErrorLike;
  return cleanText(context?.url) || cleanText(context?.endpoint) || cleanText(errorLike?.url);
}

/** 错误诊断的上下文：调用方按需传入，字段都可缺省。 */
export type ErrorDiagnosticContext = {
  operation?: string;
  jobId?: string;
  status?: unknown;
  url?: string;
  endpoint?: string;
  now?: () => string;
  details?: Record<string, unknown>;
  includeStack?: boolean;
};

function normalizeDetails(details: Record<string, unknown> = {}) {
  return Object.entries(details)
    .map(([key, value]) => [key, cleanText(value)])
    .filter(([key, value]) => value && !/api[-_]?key|token|secret|password/i.test(key));
}

export function buildErrorDiagnostic(error: unknown, context: ErrorDiagnosticContext = {}) {
  const message = inferErrorMessage(error);
  const operation = cleanText(context.operation) || "前端操作";
  const status = inferHttpStatus(error, context);
  const url = inferUrl(error, context);
  const errorLike = error as ErrorLike;
  const jobId = cleanText(context.jobId) || cleanText(errorLike?.jobId);
  const now = typeof context.now === "function" ? context.now() : new Date().toISOString();
  const details = normalizeDetails(context.details || {});
  const stack = context.includeStack === false ? "" : cleanStack(errorLike?.stack);

  const diagnosticLines = [
    "RetainPDF 前端错误诊断",
    `时间: ${now}`,
    `前端版本: ${APP_VERSION}`,
    `操作: ${operation}`,
    jobId ? `job_id: ${jobId}` : "",
    status ? `HTTP 状态码: ${status}` : "",
    url ? `URL: ${url}` : "",
    `错误信息: ${message}`,
    ...details.map(([key, value]) => `${key}: ${value}`),
    stack ? `堆栈:\n${stack}` : "",
    cleanText(globalThis.navigator?.userAgent) ? `User-Agent: ${cleanText(globalThis.navigator?.userAgent)}` : "",
  ].filter(Boolean);

  return {
    kind: "error-diagnostic",
    summary: `${operation}失败：${message}`,
    diagnostic: diagnosticLines.join("\n"),
  };
}

export function messageForErrorBox<T>(value: T): T | string {
  // 诊断对象是 buildErrorDiagnostic 的产物；其它值（字符串等）原样返回。
  const box = value as { kind?: unknown; summary?: string; diagnostic?: string } | null | undefined;
  if (value && typeof value === "object" && box?.kind === "error-diagnostic") {
    return box.summary || box.diagnostic || "操作失败";
  }
  return value;
}
