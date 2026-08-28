import {
  clampRuntimeStageKeyForJob,
  firstNonEmpty,
  isJobTerminal,
  isTerminalStatus,
  normalizeRuntimeDisplayStage,
  numberOrNull,
} from "./runtime-value-helpers.js";

export interface StageProgress {
  current?: number | null;
  total?: number | null;
  percent?: number | null;
  unit?: string | null;
  [key: string]: unknown;
}

export interface StageSnapshot {
  stageKey?: string;
  source?: string;
  publicStage?: string;
  lane?: string;
  substage?: string;
  detail?: string;
  progress?: StageProgress;
  [key: string]: unknown;
}

export interface RuntimeStatus {
  stageKey?: string;
  publicStage?: string;
  source?: string;
  lane?: string;
  substage?: string;
  detail?: string;
  progress?: StageProgress;
  [key: string]: unknown;
}

/** Item thẻ thư viện / recent-jobs (trạng thái đã merge lúc runtime). */
export interface LibraryJobItem {
  job_id?: string;
  id?: string;
  status?: string;
  stage?: string;
  display_stage?: string;
  lane?: string;
  substage?: string;
  stage_detail?: string;
  workflow?: string;
  job_type?: string;
  title?: string;
  display_name?: string;
  source_file_name?: string;
  page_count?: number | null;
  cover_url?: string;
  thumbnail_url?: string;
  created_at?: string;
  updated_at?: string;
  progress?: StageProgress;
  runtime_status?: RuntimeStatus;
  background_stages?: unknown[];
  stage_snapshot?: StageSnapshot;
  book_summary?: {
    source_file_name?: string;
    page_count?: number | null;
    [key: string]: unknown;
  };
  library_only?: boolean;
  [key: string]: unknown;
}

export interface StageAdapterPort {
  adaptJobStageSnapshot?: (job: LibraryJobItem) => StageSnapshot | null | undefined;
}

export interface RuntimeItemOptions {
  stageAdapterPort?: StageAdapterPort;
}

const EMPTY_STAGE_SNAPSHOT: StageSnapshot = Object.freeze({
  stageKey: "",
  source: "missing-stage-adapter",
  publicStage: "",
  lane: "",
  substage: "",
  detail: "",
  progress: {},
});

const IGNORED_SNAPSHOT_SOURCES = new Set(["legacy-stage", "canonical-empty-stage"]);
const PUBLIC_STAGE_KEYS = new Set(["ocr", "translate", "render", "done"]);

function isMeaningfulStageKey(value: unknown = ""): boolean {
  return !["", "idle", "running", "queued"].includes(`${value || ""}`.trim());
}

function publicStageName(stageKey = ""): string {
  return stageKey === "translate" ? "translation" : stageKey;
}

function normalizePublicStageKey(value: unknown = ""): string {
  const normalized = normalizeRuntimeDisplayStage(`${value || ""}`);
  return PUBLIC_STAGE_KEYS.has(normalized) ? normalized : "";
}

function snapshotCanDriveStage(snapshot: StageSnapshot | null | undefined = {}): boolean {
  const source = `${snapshot?.source || ""}`.trim();
  return !IGNORED_SNAPSHOT_SOURCES.has(source);
}

function directPublicStageKey(job: LibraryJobItem = {}): string {
  return normalizePublicStageKey(job.display_stage);
}

function snapshotHasPublicStage(stageSnapshot: StageSnapshot = {}): boolean {
  return Boolean(normalizePublicStageKey(stageSnapshot.publicStage) || normalizePublicStageKey(stageSnapshot.stageKey));
}

function valueOrPrevious<T>(value: T | null | undefined | "", previousValue: T): T {
  return value === undefined || value === null || value === "" ? previousValue : value;
}

/** Có giống title bẩn kiểu "dùng job_id / tên mock giả làm tên sách" không. */
function isPlaceholderBookTitle(title: string, jobId: string) {
  const t = `${title || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  if (!t) return true;
  if (id && (t === id || t === `${id}.pdf`)) return true;
  if (/^Mock(\s|retry|-|_)/i.test(t)) return true;
  if (/^mock-/i.test(t)) return true;
  return false;
}

function pickBookTitle(
  previousItem: LibraryJobItem = {},
  job: LibraryJobItem = {},
  jobId = "",
) {
  const previous = firstNonEmpty(previousItem.title, previousItem.display_name);
  const next = firstNonEmpty(job.title, job.display_name);
  if (!next) return previous;
  if (!previous) return next;
  if (isPlaceholderBookTitle(next, jobId) || isPlaceholderBookTitle(next, firstNonEmpty(job.job_id))) {
    return previous;
  }
  return next;
}

function pickBookDisplayName(
  previousItem: LibraryJobItem = {},
  job: LibraryJobItem = {},
  jobId = "",
) {
  const previous = firstNonEmpty(previousItem.display_name, previousItem.title);
  const next = firstNonEmpty(job.display_name, job.title);
  if (!next) return previous;
  if (!previous) return next;
  if (isPlaceholderBookTitle(next, jobId) || isPlaceholderBookTitle(next, firstNonEmpty(job.job_id))) {
    return previous;
  }
  return next;
}

function runtimeStatusFromSnapshot(
  stageSnapshot: StageSnapshot = {},
  {
    previousRuntimeStatus = {},
    stage = "",
    stageDetail = "",
    progress = {},
    isBackgroundPatch = false,
  }: {
    previousRuntimeStatus?: RuntimeStatus;
    stage?: string;
    stageDetail?: string;
    progress?: StageProgress;
    isBackgroundPatch?: boolean;
  } = {},
): RuntimeStatus {
  if (isBackgroundPatch) {
    return previousRuntimeStatus && typeof previousRuntimeStatus === "object"
      ? { ...previousRuntimeStatus }
      : {};
  }
  return {
    stageKey: stage,
    publicStage: stageSnapshot.publicStage,
    source: stageSnapshot.source,
    lane: stageSnapshot.lane,
    substage: stageSnapshot.substage,
    detail: stageDetail,
    progress: { ...progress },
  };
}

function stageSnapshotForJob(
  job: LibraryJobItem = {},
  stageAdapterPort: StageAdapterPort = {},
): StageSnapshot {
  const displayStageKey = clampRuntimeStageKeyForJob(directPublicStageKey(job), job);
  if (displayStageKey) {
    const adaptJobStageSnapshot = stageAdapterPort.adaptJobStageSnapshot;
    const adapted = typeof adaptJobStageSnapshot === "function"
      ? adaptJobStageSnapshot(job)
      : null;
    return {
      stageKey: displayStageKey,
      source: "display-stage",
      publicStage: publicStageName(displayStageKey),
      lane: firstNonEmpty(job.lane, "main"),
      substage: firstNonEmpty(job.substage),
      detail: firstNonEmpty(adapted?.detail, job.stage_detail),
      progress: adapted?.progress || (job.progress && typeof job.progress === "object" ? job.progress : {}),
    };
  }
  if (job.stage_snapshot && typeof job.stage_snapshot === "object" && snapshotCanDriveStage(job.stage_snapshot)) {
    const snapshot = job.stage_snapshot;
    const clampedStageKey = clampRuntimeStageKeyForJob(snapshot.stageKey, job);
    const clampedPublicStage = clampRuntimeStageKeyForJob(
      normalizePublicStageKey(snapshot.publicStage),
      job,
    );
    if (clampedStageKey === snapshot.stageKey
        && clampedPublicStage === normalizePublicStageKey(snapshot.publicStage)) {
      return snapshot;
    }
    return {
      ...snapshot,
      stageKey: clampedStageKey,
      publicStage: clampedPublicStage
        ? publicStageName(clampedPublicStage)
        : snapshot.publicStage,
    };
  }
  const adaptJobStageSnapshot = stageAdapterPort.adaptJobStageSnapshot;
  const adapted = typeof adaptJobStageSnapshot === "function"
    ? adaptJobStageSnapshot(job)
    : EMPTY_STAGE_SNAPSHOT;
  return snapshotCanDriveStage(adapted) ? (adapted as StageSnapshot) : EMPTY_STAGE_SNAPSHOT;
}

export function buildRecentJobRuntimeSnapshot(
  job: LibraryJobItem = {},
  { stageAdapterPort = {} }: RuntimeItemOptions = {},
): StageSnapshot {
  const stageSnapshot = stageSnapshotForJob(job, stageAdapterPort);
  return {
    stageKey: stageSnapshot.stageKey,
    source: stageSnapshot.source,
    publicStage: stageSnapshot.publicStage,
    lane: stageSnapshot.lane,
    substage: stageSnapshot.substage,
    detail: stageSnapshot.detail,
    progress: stageSnapshot.progress || {},
  };
}

export function mergeLibraryJobItem(
  previousItem: LibraryJobItem = {},
  job: LibraryJobItem = {},
  { stageAdapterPort = {} }: RuntimeItemOptions = {},
): LibraryJobItem {
  const jobId = firstNonEmpty(job.job_id, previousItem.job_id);
  const stageSnapshot = buildRecentJobRuntimeSnapshot(job, { stageAdapterPort });
  const hasPublicStage = snapshotHasPublicStage(stageSnapshot);
  const isBackgroundPatch = hasPublicStage && stageSnapshot.lane === "background";
  const previousRuntimeStatus = previousItem.runtime_status && typeof previousItem.runtime_status === "object"
    ? previousItem.runtime_status
    : {};
  const stageKey = stageSnapshot.stageKey;
  const stageFallback = stageSnapshot.source === "canonical-empty-stage"
    ? previousItem.stage
    : previousItem.stage;
  const stage = isMeaningfulStageKey(stageKey)
    ? stageKey
    : stageFallback;
  const summarizedDetail = stageSnapshot.detail;
  const stageDetail = isBackgroundPatch
    ? firstNonEmpty(previousItem.stage_detail, job.stage_detail)
    : summarizedDetail && summarizedDetail !== "Đang chờ tác vụ bắt đầu"
    ? summarizedDetail
    : previousItem.stage_detail;
  const previousProgress = previousItem.progress && typeof previousItem.progress === "object"
    ? previousItem.progress
    : {};
  const progress: StageProgress = isBackgroundPatch
    ? { ...previousProgress }
    : {
        ...previousProgress,
        current: valueOrPrevious(stageSnapshot.progress?.current, previousProgress.current),
        total: valueOrPrevious(stageSnapshot.progress?.total, previousProgress.total),
        percent: valueOrPrevious(stageSnapshot.progress?.percent, previousProgress.percent),
        unit: valueOrPrevious(stageSnapshot.progress?.unit, previousProgress.unit),
      };
  if (isJobTerminal(job) && job.status === "succeeded") {
    progress.percent = 100;
    if (progress.total !== undefined && progress.total !== null) {
      progress.current = progress.total;
    }
  } else if (isJobTerminal(job) || (isTerminalStatus(job.status) && job.status !== "succeeded")) {
    progress.percent = valueOrPrevious(stageSnapshot.progress?.percent, previousProgress.percent);
  }
  const runtimeStatus = runtimeStatusFromSnapshot(stageSnapshot, {
    previousRuntimeStatus,
    stage,
    stageDetail,
    progress,
    isBackgroundPatch,
  });
  const nextRuntimeStatus = hasPublicStage ? runtimeStatus : { ...previousRuntimeStatus };
  const nextLibraryOnly = Object.prototype.hasOwnProperty.call(job, "library_only")
    ? Boolean(job.library_only)
    : previousItem.library_only;

  return {
    ...previousItem,
    job_id: jobId,
    id: previousItem.id || jobId,
    // Document-centric: create/patch phải giữ document_id, nếu không merge live ở detail sẽ không khớp dòng thư viện.
    document_id: firstNonEmpty(job.document_id, previousItem.document_id),
    active_job_id: firstNonEmpty(job.active_job_id, previousItem.active_job_id, jobId),
    library_only: nextLibraryOnly,
    status: firstNonEmpty(job.status, previousItem.status),
    stage,
    display_stage: isBackgroundPatch
      ? previousItem.display_stage
      : hasPublicStage
        ? firstNonEmpty(stageSnapshot.publicStage, previousItem.display_stage)
        : previousItem.display_stage,
    lane: isBackgroundPatch
      ? previousItem.lane
      : hasPublicStage
        ? firstNonEmpty(stageSnapshot.lane, previousItem.lane)
        : previousItem.lane,
    substage: isBackgroundPatch
      ? previousItem.substage
      : hasPublicStage
        ? firstNonEmpty(stageSnapshot.substage, previousItem.substage)
        : previousItem.substage,
    background_stages: isBackgroundPatch
      ? [
          {
            display_stage: stageSnapshot.publicStage,
            stage: stageSnapshot.stageKey,
            substage: stageSnapshot.substage,
            lane: stageSnapshot.lane,
            progress: stageSnapshot.progress,
            stage_detail: stageSnapshot.detail,
          },
        ]
      : (Array.isArray(job.background_stages) ? job.background_stages : previousItem.background_stages),
    stage_detail: stageDetail,
    workflow: firstNonEmpty(job.workflow, job.job_type, previousItem.workflow),
    job_type: firstNonEmpty(job.job_type, job.workflow, previousItem.job_type),
    // Metadata sách: nếu patch polling/retry gửi job_id hoặc "Mock retry..." làm title thì không ghi đè tên thật.
    // Patch đổi tên thật (title khác job_id) vẫn được cập nhật.
    title: pickBookTitle(previousItem, job, jobId),
    display_name: pickBookDisplayName(previousItem, job, jobId),
    source_file_name: firstNonEmpty(
      previousItem.source_file_name,
      job.source_file_name,
      job.book_summary?.source_file_name,
    ),
    page_count: valueOrPrevious(
      numberOrNull(job.page_count ?? job.book_summary?.page_count),
      previousItem.page_count,
    ),
    cover_url: firstNonEmpty(previousItem.cover_url, job.cover_url),
    thumbnail_url: firstNonEmpty(previousItem.thumbnail_url, job.thumbnail_url),
    updated_at: firstNonEmpty(job.updated_at, previousItem.updated_at),
    progress,
    runtime_status: nextRuntimeStatus,
  };
}

export function createLibraryJobItemFromRuntime(
  job: LibraryJobItem = {},
  { stageAdapterPort = {} }: RuntimeItemOptions = {},
): LibraryJobItem | null {
  const jobId = firstNonEmpty(job.job_id);
  if (!jobId) {
    return null;
  }
  return mergeLibraryJobItem({
    id: jobId,
    job_id: jobId,
    title: jobId,
    display_name: jobId,
    source_file_name: "",
    page_count: null,
    status: "queued",
    stage: "queued",
    stage_detail: "Tác vụ đã được gửi",
    progress: {},
    created_at: job.created_at || new Date().toISOString(),
    updated_at: job.updated_at || new Date().toISOString(),
  }, job, { stageAdapterPort });
}

export function mergeRuntimePatches(
  items: LibraryJobItem[] | null | undefined,
  patches: Map<string, LibraryJobItem>,
  { stageAdapterPort = {} }: RuntimeItemOptions = {},
): LibraryJobItem[] {
  const list = Array.isArray(items) ? items : [];
  // Index theo job_id; đồng thời lập document_id -> patch mới nhất (dùng khi retry đổi id).
  const patchByDocumentId = new Map<string, LibraryJobItem>();
  for (const patch of patches.values()) {
    const docId = firstNonEmpty(patch?.document_id);
    if (docId) {
      patchByDocumentId.set(docId, patch);
    }
  }
  return list.map((item) => {
    const jobId = firstNonEmpty(item?.job_id);
    const documentId = firstNonEmpty(item?.document_id);
    let patch = jobId ? patches.get(jobId) : null;
    if (!patch && documentId) {
      patch = patchByDocumentId.get(documentId) || null;
    }
    if (!patch) {
      return item;
    }
    // Ghi đè bằng job_id của patch (sau retry, sách vẫn ở đúng vị trí cũ trong thư viện).
    return mergeLibraryJobItem(item, {
      ...patch,
      job_id: firstNonEmpty(patch.job_id, item.job_id),
      active_job_id: firstNonEmpty(patch.active_job_id, patch.job_id, item.active_job_id),
      library_only: false,
    }, { stageAdapterPort });
  });
}
