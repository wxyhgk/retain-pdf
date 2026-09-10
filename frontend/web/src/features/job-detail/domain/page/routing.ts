import { defaultJobDetailConfigPort } from "./config-port.js";

export { firstNonEmpty as firstNonEmptyText, firstJobIdFromPayload } from "@retainpdf/domain/job";

export function getJobIdFromQuery() {
  return new URLSearchParams(window.location.search).get("job_id")?.trim() || "";
}

export function buildReaderPageUrl(jobId) {
  return defaultJobDetailConfigPort.buildReaderPageUrl(jobId);
}

export function buildDetailPageUrl(jobId) {
  return defaultJobDetailConfigPort.buildDetailPageUrl(jobId);
}
