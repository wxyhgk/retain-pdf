// 子 store 经全局 Symbol 注册表挂在 state 身份键上(见 features/job-runtime),
// 这里按约束不 import 该目录,直接经 Symbol.for 读快照
const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");
const SECONDARY_RESOURCE_STORE_KEY = Symbol.for("retainpdf.secondaryResourceStore");
function currentJobStoreSnapshot(state) {
    return state?.[CURRENT_JOB_STORE_KEY]
        ?.getSnapshot?.() || null;
}
// 兼容:未挂载 store 的纯快照对象(测试/静态构造)按字段名直读
function currentJobId(state) {
    const snapshot = currentJobStoreSnapshot(state);
    if (snapshot) {
        return `${snapshot.jobId || ""}`.trim();
    }
    return `${state?.currentJobId || ""}`.trim();
}
function currentJobSnapshot(state) {
    const snapshot = currentJobStoreSnapshot(state);
    if (snapshot) {
        return snapshot.snapshot || null;
    }
    return state?.currentJobSnapshot || null;
}
function cachedManifestFor(state, jobId) {
    const store = state?.[SECONDARY_RESOURCE_STORE_KEY];
    if (store?.getSnapshot) {
        const record = store.getSnapshot()?.manifest || null;
        return record && jobId && record.jobId === jobId ? record.payload || null : null;
    }
    if (!state || !jobId || state.currentJobManifestJobId !== jobId) {
        return null;
    }
    return state.currentJobManifest || null;
}
function uploadSnapshot(state) {
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
let defaultDeps = {};
export function createArtifactRuntimePort({ getCurrentJobId = currentJobId, getCurrentJobSnapshot = currentJobSnapshot, getCachedManifestFor = cachedManifestFor, getUploadSnapshot = uploadSnapshot, } = {}) {
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
    currentJobId: (state) => (defaultDeps.getCurrentJobId || currentJobId)(state),
    currentJobSnapshot: (state) => (defaultDeps.getCurrentJobSnapshot || currentJobSnapshot)(state),
    cachedManifestFor: (state, jobId) => (defaultDeps.getCachedManifestFor || cachedManifestFor)(state, jobId),
    uploadSnapshot: (state) => (defaultDeps.getUploadSnapshot || uploadSnapshot)(state),
});
export function configureDefaultArtifactRuntimePort(deps = {}) {
    defaultDeps = { ...deps };
    return defaultArtifactRuntimePort;
}
