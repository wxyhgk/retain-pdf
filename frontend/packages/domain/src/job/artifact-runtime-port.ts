import type {
  ArtifactRuntimePortDeps,
  ArtifactRuntimeState,
  JobLike,
  JobPayload,
  ManifestPayload,
  UploadSnapshot,
} from "./types.js";

// 子 store 经全局 Symbol 注册表挂在 state 身份键上(见 features/job-runtime),
// 这里按约束不 import 该目录,直接经 Symbol.for 读快照
const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");
const SECONDARY_RESOURCE_STORE_KEY = Symbol.for("retainpdf.secondaryResourceStore");

function currentJobStoreSnapshot(state: ArtifactRuntimeState | null | undefined) {
  return (state as { [key: symbol]: { getSnapshot?: () => { jobId?: string; snapshot?: JobLike | JobPayload | null } | null } } | null | undefined)
    ?.[CURRENT_JOB_STORE_KEY]
    ?.getSnapshot
    ?.() || null;
}

// 兼容:未挂载 store 的纯快照对象(测试/静态构造)按字段名直读
function currentJobId(state?: ArtifactRuntimeState | null): string {
  const snapshot = currentJobStoreSnapshot(state);
  if (snapshot) {
    return `${snapshot.jobId || ""}`.trim();
  }
  return `${state?.currentJobId || ""}`.trim();
}

function currentJobSnapshot(state?: ArtifactRuntimeState | null): JobLike | JobPayload | null {
  const snapshot = currentJobStoreSnapshot(state);
  if (snapshot) {
    return snapshot.snapshot || null;
  }
  return state?.currentJobSnapshot || null;
}

function cachedManifestFor(
  state: ArtifactRuntimeState | null | undefined,
  jobId: string,
): ManifestPayload | null {
  const store = (state as { [key: symbol]: { getSnapshot?: () => { manifest?: { jobId?: string; payload?: ManifestPayload | null } | null } | null } } | null | undefined)
    ?.[SECONDARY_RESOURCE_STORE_KEY];
  if (store?.getSnapshot) {
    const record = store.getSnapshot()?.manifest || null;
    return record && jobId && record.jobId === jobId ? record.payload || null : null;
  }
  if (!state || !jobId || state.currentJobManifestJobId !== jobId) {
    return null;
  }
  return state.currentJobManifest || null;
}

function uploadSnapshot(state?: ArtifactRuntimeState | null): UploadSnapshot {
  const source = state || {};
  return {
    uploadId: source.uploadId || "",
    uploadedFileName: source.uploadedFileName || "",
    uploadedPageCount: source.uploadedPageCount || 0,
    uploadedBytes: source.uploadedBytes || 0,
    appliedPageRange: source.appliedPageRange || "",
    submitBusy: Boolean(source.submitBusy),
  };
}

let defaultDeps: ArtifactRuntimePortDeps = {};

export function createArtifactRuntimePort({
  getCurrentJobId = currentJobId,
  getCurrentJobSnapshot = currentJobSnapshot,
  getCachedManifestFor = cachedManifestFor,
  getUploadSnapshot = uploadSnapshot,
}: ArtifactRuntimePortDeps = {}) {
  return Object.freeze({
    currentJobId: (state) => getCurrentJobId(state),
    currentJobSnapshot: (state) => getCurrentJobSnapshot(state),
    cachedManifestFor: (state, jobId) => getCachedManifestFor(state, jobId),
    uploadSnapshot: (state) => getUploadSnapshot(state),
  });
}

// Keep a stable object: artifacts.ts captures this port at module evaluation,
// while the host configures its dependencies during application boot.
export const defaultArtifactRuntimePort = Object.freeze({
  currentJobId: (state?: ArtifactRuntimeState | null) => (
    defaultDeps.getCurrentJobId || currentJobId
  )(state),
  currentJobSnapshot: (state?: ArtifactRuntimeState | null) => (
    defaultDeps.getCurrentJobSnapshot || currentJobSnapshot
  )(state),
  cachedManifestFor: (state: ArtifactRuntimeState | null | undefined, jobId: string) => (
    defaultDeps.getCachedManifestFor || cachedManifestFor
  )(state, jobId),
  uploadSnapshot: (state?: ArtifactRuntimeState | null) => (
    defaultDeps.getUploadSnapshot || uploadSnapshot
  )(state),
});

export function configureDefaultArtifactRuntimePort(
  deps: ArtifactRuntimePortDeps = {},
) {
  defaultDeps = { ...deps };
  return defaultArtifactRuntimePort;
}
