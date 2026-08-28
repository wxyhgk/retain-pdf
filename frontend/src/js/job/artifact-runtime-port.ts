import { getUploadState } from "../features/upload/state.js";
import type {
  ArtifactRuntimePortDeps,
  ArtifactRuntimeState,
  JobLike,
  JobPayload,
  ManifestPayload,
  UploadSnapshot,
} from "./types.js";

// Sub store được gắn trên khóa định danh state thông qua bảng đăng ký Symbol toàn cục (xem features/job-runtime),
// ở đây theo ràng buộc không import thư mục đó, đọc snapshot trực tiếp qua Symbol.for
const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");
const SECONDARY_RESOURCE_STORE_KEY = Symbol.for("retainpdf.secondaryResourceStore");

function currentJobStoreSnapshot(state: ArtifactRuntimeState | null | undefined) {
  return (state as { [key: symbol]: { getSnapshot?: () => { jobId?: string; snapshot?: JobLike | JobPayload | null } | null } } | null | undefined)
    ?.[CURRENT_JOB_STORE_KEY]
    ?.getSnapshot
    ?.() || null;
}

// Tương thích: đối tượng snapshot thuần chưa gắn store (kiểm thử/xây dựng tĩnh) đọc trực tiếp theo tên trường
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
  const snapshot = getUploadState();
  // Singleton là giá trị chính; đối tượng snapshot thuần (kiểm thử/xây dựng tĩnh) đọc trực tiếp theo tên trường khi singleton rỗng
  const source = !snapshot.uploadId && state && ("uploadId" in state || "uploadedFileName" in state) && !(Symbol.for("retainpdf.currentJobStore") in (state || {}))
    ? state
    : snapshot;
  return {
    uploadId: source.uploadId || "",
    uploadedFileName: source.uploadedFileName || "",
    uploadedPageCount: source.uploadedPageCount || 0,
    uploadedBytes: source.uploadedBytes || 0,
    appliedPageRange: source.appliedPageRange || "",
    submitBusy: Boolean(source.submitBusy),
  };
}

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

export const defaultArtifactRuntimePort = createArtifactRuntimePort();
