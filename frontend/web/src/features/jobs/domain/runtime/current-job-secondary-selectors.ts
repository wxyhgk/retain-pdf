import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
} from "./secondary-resource-cache.js";

// 经全局 Symbol 读 current-job store(直接 import current-job-state.js 会循环依赖);
// 无 store 的纯快照对象按字段名直读
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
