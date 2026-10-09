import { APP_VERSION } from "../generated/app-version.js";

function cleanText(value) {
  return `${value ?? ""}`.trim();
}

function cleanStack(value) {
  return cleanText(value).split("\n").slice(0, 8).join("\n");
}

function inferErrorMessage(error) {
  if (!error) {
    return "未知错误";
  }
  if (typeof error === "string") {
    return error;
  }
  return cleanText(error.message) || cleanText(error.statusText) || String(error);
}

function inferHttpStatus(error, context) {
  const status = context?.status ?? error?.status ?? error?.statusCode ?? error?.httpStatus;
  return status === undefined || status === null || status === "" ? "" : `${status}`;
}

function inferUrl(error, context) {
  return cleanText(context?.url) || cleanText(context?.endpoint) || cleanText(error?.url);
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

export function buildErrorDiagnostic(error, context: ErrorDiagnosticContext = {}) {
  const message = inferErrorMessage(error);
  const operation = cleanText(context.operation) || "前端操作";
  const status = inferHttpStatus(error, context);
  const url = inferUrl(error, context);
  const jobId = cleanText(context.jobId) || cleanText(error?.jobId);
  const now = typeof context.now === "function" ? context.now() : new Date().toISOString();
  const details = normalizeDetails(context.details || {});
  const stack = context.includeStack === false ? "" : cleanStack(error?.stack);

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

export function messageForErrorBox(value) {
  if (value && typeof value === "object" && value.kind === "error-diagnostic") {
    return value.summary || value.diagnostic || "操作失败";
  }
  return value;
}
