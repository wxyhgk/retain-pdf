import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
} from "./secondary-resource-cache.js";

// qua Toàn cầu Symbol đọc current-job store(trực tiếp import current-job-state.js sẽ theo chu kỳ phụ thuộc vào);
// Không có store của các đối tượng ảnh chụp nhanh thuần túy được đọc theo tên trường
const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");

function currentJobId(state) {
  const snapshot = state?.[CURRENT_JOB_STORE_KEY]?.getSnapshot?.();
  if (snapshot) {
    return `${snapshot.jobId || ""}`.trim();
  }
  return `${state?.currentJobId || ""}`.trim();
}

export function currentJobManifest(state) {
  return cachedManifestFor(state, currentJobId(state));
}

export function currentJobStageActions(state) {
  return cachedStageActionsFor(state, currentJobId(state));
}

export function currentJobEventsFor(state, jobId) {
  return cachedEventsFor(state, jobId);
}
