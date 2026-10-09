import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
} from "./secondary-resource-cache.js";

// 经全局 Symbol 读 current-job store(直接 import current-job-state.js 会循环依赖);
// 无 store 的纯快照对象按字段名直读
const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");

type CurrentJobStateLike = {
  [CURRENT_JOB_STORE_KEY]?: { getSnapshot?: () => { jobId?: string } | null | undefined };
  currentJobId?: string;
} | null | undefined;

function currentJobId(state: unknown) {
  // state 可能是带 store 的运行时状态，也可能是纯快照对象，只按这两个字段读。
  const runtimeState = state as CurrentJobStateLike;
  const snapshot = runtimeState?.[CURRENT_JOB_STORE_KEY]?.getSnapshot?.();
  if (snapshot) {
    return `${snapshot.jobId || ""}`.trim();
  }
  return `${runtimeState?.currentJobId || ""}`.trim();
}

export function currentJobManifest(state: unknown) {
  return cachedManifestFor(state, currentJobId(state));
}

export function currentJobStageActions(state: unknown) {
  return cachedStageActionsFor(state, currentJobId(state));
}

export function currentJobEventsFor(state: unknown, jobId: unknown) {
  return cachedEventsFor(state, jobId);
}
