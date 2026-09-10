import { isJobTerminal } from "./core.js";
import { normalizeJobPayload } from "./normalize.js";

export function buildWorkflowSectionsViewModel(job = null) {
  const normalized = job ? normalizeJobPayload(job) : null;
  const hasJob = Boolean(normalized && normalized.job_id);
  return {
    hasJob,
    processing: hasJob ? !isJobTerminal(normalized) : false,
  };
}

export function buildJobWarningViewModel(status) {
  return {
    active: status === "queued" || status === "running",
  };
}
