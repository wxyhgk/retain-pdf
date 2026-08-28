import { APP_VERSION } from "../generated/app-version.js";

function cleanText(value) {
  return `${value ?? ""}`.trim();
}

function cleanStack(value) {
  return cleanText(value).split("\n").slice(0, 8).join("\n");
}

function inferErrorMessage(error) {
  if (!error) {
    return "Lỗi không xác định";
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

function normalizeDetails(details: any = {}) {
  return Object.entries(details)
    .map(([key, value]) => [key, cleanText(value)])
    .filter(([key, value]) => value && !/api[-_]?key|token|secret|password/i.test(key));
}

export function buildErrorDiagnostic(error, context: any = {}) {
  const message = inferErrorMessage(error);
  const operation = cleanText(context.operation) || "Thao tác frontend";
  const status = inferHttpStatus(error, context);
  const url = inferUrl(error, context);
  const jobId = cleanText(context.jobId) || cleanText(error?.jobId);
  const now = typeof context.now === "function" ? context.now() : new Date().toISOString();
  const details = normalizeDetails(context.details || {});
  const stack = context.includeStack === false ? "" : cleanStack(error?.stack);

  const diagnosticLines = [
    "Chẩn đoán lỗi RetainPDF frontend",
    `Thời gian: ${now}`,
    `Phiên bản frontend: ${APP_VERSION}`,
    `Thao tác: ${operation}`,
    jobId ? `job_id: ${jobId}` : "",
    status ? `Mã trạng thái HTTP: ${status}` : "",
    url ? `URL: ${url}` : "",
    `Thông tin lỗi: ${message}`,
    ...details.map(([key, value]) => `${key}: ${value}`),
    stack ? `Ngăn xếp:\n${stack}` : "",
    cleanText(globalThis.navigator?.userAgent) ? `User-Agent: ${cleanText(globalThis.navigator?.userAgent)}` : "",
  ].filter(Boolean);

  return {
    kind: "error-diagnostic",
    summary: `${operation} thất bại: ${message}`,
    diagnostic: diagnosticLines.join("\n"),
  };
}

export function messageForErrorBox(value) {
  if (value && typeof value === "object" && value.kind === "error-diagnostic") {
    return value.summary || value.diagnostic || "Thao tác thất bại";
  }
  return value;
}
