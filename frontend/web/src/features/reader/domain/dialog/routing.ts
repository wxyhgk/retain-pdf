import { defaultReaderDialogConfigPort } from "./config-port.js";

export function jobIdFromReaderUrl(url) {
  const raw = `${url || ""}`.trim();
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw, window.location.href).searchParams.get("job_id")?.trim() || "";
  } catch (_err) {
    return "";
  }
}

export function currentReaderArtifactUrls(state, runtimePort) {
  return runtimePort?.currentArtifactUrls?.(state) || {};
}

export function buildReaderPageUrl(jobId, anchor = null) {
  return defaultReaderDialogConfigPort.buildReaderPageUrl(jobId, anchor);
}

export function buildReaderDocumentPageUrl(documentId, anchor = null) {
  return defaultReaderDialogConfigPort.buildReaderDocumentPageUrl(documentId, anchor);
}

export function buildReaderRouteUrl(jobId) {
  return defaultReaderDialogConfigPort.buildReaderRouteUrl(jobId);
}

export function requestedReaderJobIdFromLocation() {
  return defaultReaderDialogConfigPort.requestedReaderJobIdFromLocation();
}
