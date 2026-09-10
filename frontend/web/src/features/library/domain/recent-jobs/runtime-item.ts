import {
  clampRuntimeStageKeyForJob,
  firstNonEmpty,
  isJobTerminal,
  isTerminalStatus,
  normalizeRuntimeDisplayStage,
  numberOrNull,
} from "./runtime-value-helpers.js";
import { sameLibraryCard } from "./library-card-identity.js";

/**
 * 卡片合并规则显性化（不改行为）。
 *
 * mergeLibraryJobItem(previousItem, job) 前置：双参可空（按 {} 处理）。
 * 优先级：
 *  P1 身份：job_id/document_id/active_job_id 取首个非空；书名 display_name 遇占位
 *    （job_id/mock 名冒充）保留旧真名（[I3] 换 id 继承身份的展示侧）。
 *  P2 运行态：background lane 补丁冻结前景（stage/display/progress 全保留旧值）；
 *     前景按 snapshot 驱动 stage/display/lane/substage。
 *  P3 [I1 运行态不降级] status 取首个非空、progress 按 valueOrPrevious 合并，空快照
 *     不清旧进度。
 *  P4 [I2 终态优先] succeeded 钉 percent=100 + current=total；其余终态保留旧 percent
 *     口径（终态展示不被空快照冲掉）。
 * mergeRuntimePatches(items, patches) 前置：items 可空按 []，patches 可空按空表；
 * 优先级：无命中补丁原样返回 -> 有命中按 sameLibraryCard 就地 mergeLibraryJobItem
 * （job_id/active_job_id 切到新轮，library_only=false 点亮运行态）。
 * createLibraryJobItemFromRuntime(job) 前置：缺 job_id 返回 null（早返）；否则以
 * queued 骨架为底再 merge，保证裸提交首帧即转圈（[I1]）。
 */

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

/** 图书馆 / recent-jobs 卡片条目(运行时合并态) */
export interface LibraryJobItem {
  job_id?: string;
  document_id?: string;
  active_job_id?: string;
  source_job_id?: string;
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
  output_pdf_ready?: boolean;
  markdown_ready?: boolean;
  bundle_ready?: boolean;
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

/** 是否像「用 job_id / mock 名冒充书名」的脏 title */
function isPlaceholderBookTitle(title: string, jobId: string) {
  const t = `${title || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  if (!t) return true;
  if (id && (t === id || t === `${id}.pdf`)) return true;
  if (/^Mock(\s|重试|-|_)/i.test(t)) return true;
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
    : summarizedDetail && summarizedDetail !== "等待任务开始"
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
  const previousArtifacts = previousItem.artifacts && typeof previousItem.artifacts === "object"
    ? previousItem.artifacts as Record<string, unknown>
    : {};
  const nextArtifacts = job.artifacts && typeof job.artifacts === "object"
    ? job.artifacts as Record<string, unknown>
    : null;

  return {
    ...previousItem,
    job_id: jobId,
    id: previousItem.id || jobId,
    // 文档中心化：创建/补丁必须保留 document_id，否则详情 live 合并对不上馆藏行
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
    // Keep canonical readiness and OCR artifact links fresh across polling.
    // OCR-only completion is represented by artifacts.normalized_document.ready,
    // not by output_pdf_ready.
    output_pdf_ready: valueOrPrevious(job.output_pdf_ready, previousItem.output_pdf_ready),
    markdown_ready: valueOrPrevious(job.markdown_ready, previousItem.markdown_ready),
    bundle_ready: valueOrPrevious(job.bundle_ready, previousItem.bundle_ready),
    artifacts: nextArtifacts
      ? { ...previousArtifacts, ...nextArtifacts }
      : previousItem.artifacts,
    artifacts_display: Array.isArray(job.artifacts_display)
      ? job.artifacts_display
      : previousItem.artifacts_display,
    // 书目元数据：轮询/重试补丁若带 job_id 或 "Mock 重试…" 当标题，不盖真书名；
    // 真·改名补丁（title 与 job_id 不同）仍可更新。
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
  // 前置：缺 job_id 建不出卡 -> null 早返；否则 queued 骨架打底再 merge（[I1] 裸提交即转圈）。
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
    stage_detail: "任务已提交",
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
  // 前置：items 可空按 []；patches 为空直接返回原序浅拷贝（早返，不改行为）。
  const list = Array.isArray(items) ? items : [];
  const patchList = patches ? Array.from(patches.values()) : [];
  if (patchList.length === 0) {
    return [...list];
  }
  return list.map((item) => {
    const patch = patchList.find((candidate) => sameLibraryCard(candidate, item)) || null;
    // 早返：无命中补丁 -> 原样返回（终态/运行态都不动）。
    if (!patch) {
      return item;
    }
    // 命中：用 patch 的 job_id 覆盖（重试后书架仍是原位原书）// [I3]
    return mergeLibraryJobItem(item, {
      ...patch,
      job_id: firstNonEmpty(patch.job_id, item.job_id),
      active_job_id: firstNonEmpty(patch.active_job_id, patch.job_id, item.active_job_id),
      library_only: false,
    }, { stageAdapterPort });
  });
}
