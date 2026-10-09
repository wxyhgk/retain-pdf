// Runtime 补丁的纯合并规则（不改行为，只写清前置条件与优先级）。
//
// 三条不变式：
// - [I1 运行态不降级] active 盖过 queued/空状态，同 stage+unit+total 下 current 不倒退。
// - [I2 终态优先] 同 job_id 终态后到非终态脏轮询一律保留终态；新终态永远可落地。
// - [I3 换 id 继承身份] 重试换 job_id 时只继承书目身份（document_id/title/封面），
//   绝不继承旧运行态/旧终态；旧 patch 键必须删除，避免双卡。

import { isRecentJobActive } from "./card-presenter.js";
import {
  clampRuntimeStageKeyForJob,
  firstNonEmpty,
  isJobTerminal,
  isTerminalStatus,
  normalizeRuntimeDisplayStage,
  numberOrNull,
} from "./runtime-value-helpers.js";
import type {
  LibraryJobItem,
  StageAdapterPort,
  StageProgress,
  StageSnapshot,
} from "./runtime-item-types.js";

/** Runtime job patch: library item plus optional flat progress fields from polling. */
export interface RuntimeJobPatch extends LibraryJobItem {
  progress_current?: number | null;
  progress_total?: number | null;
  progress_unit?: string;
  stage_snapshot?: StageSnapshot | null;
}

export interface RuntimePatchMergeOptions {
  stageAdapterPort?: StageAdapterPort;
}

const IGNORED_SNAPSHOT_SOURCES = new Set(["legacy-stage", "canonical-empty-stage"]);
const PATCH_STAGE_KEYS = new Set(["ocr", "translate", "render", "done"]);

/**
 * 书架以 document 为身份，不能把只有 job_id 的提交首帧当成一本新书。
 * `/jobs` 的创建响应目前不保证返回 document_id；真正的文档投影会由
 * `/documents` 的 soft refresh 补齐。在此之前只缓存运行补丁，不渲染空壳卡。
 */
export function hasStableLibraryIdentity(job: RuntimeJobPatch | LibraryJobItem = {}) {
  const jobId = `${job?.job_id || ""}`.trim();
  const documentId = `${job?.document_id || ""}`.trim();
  const title = firstNonEmpty(job?.title, job?.display_name, job?.source_file_name);
  return Boolean(
    documentId
    && title
    && title !== jobId
    && title !== `${jobId}.pdf`
    && !/^mock-/i.test(title),
  );
}

function normalizedPatchStage(value = "") {
  const normalized = normalizeRuntimeDisplayStage(value);
  return PATCH_STAGE_KEYS.has(normalized) ? normalized : "";
}

function finiteProgressOrNull(value: unknown): number | null {
  // book-detail 口径收紧：Number(null)/Number("") === 0 会把缺数当成 0%，
  // 进度单调性只在双边有限数下才可比。
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function trustedStageSnapshot(
  job: RuntimeJobPatch = {},
  stageAdapterPort: StageAdapterPort = {},
): StageSnapshot | null {
  const snapshot = job?.stage_snapshot && typeof job.stage_snapshot === "object"
    ? job.stage_snapshot
    : typeof stageAdapterPort.adaptJobStageSnapshot === "function"
      ? stageAdapterPort.adaptJobStageSnapshot(job)
      : null;
  const source = `${snapshot?.source || ""}`.trim();
  return snapshot && !IGNORED_SNAPSHOT_SOURCES.has(source) ? snapshot : null;
}

function stageKeyForPatch(
  job: RuntimeJobPatch = {},
  stageAdapterPort: StageAdapterPort = {},
) {
  const rawStage = normalizedPatchStage(job.display_stage)
    || normalizedPatchStage(trustedStageSnapshot(job, stageAdapterPort)?.publicStage)
    || normalizedPatchStage(trustedStageSnapshot(job, stageAdapterPort)?.stageKey);
  return clampRuntimeStageKeyForJob(rawStage, job);
}

function progressOfPatch(job: RuntimeJobPatch = {}): StageProgress {
  const progress = job?.progress && typeof job.progress === "object"
    ? job.progress
    : job?.stage_snapshot?.progress;
  return progress && typeof progress === "object" ? progress : {};
}

function sameRuntimeJobId(
  previous: RuntimeJobPatch = {},
  next: RuntimeJobPatch = {},
) {
  const previousId = `${previous.job_id || ""}`.trim();
  const nextId = `${next.job_id || ""}`.trim();
  return Boolean(previousId && nextId && previousId === nextId);
}

function shouldKeepPreviousRuntimePatch(
  previous: RuntimeJobPatch = {},
  next: RuntimeJobPatch = {},
  { stageAdapterPort = {} }: RuntimePatchMergeOptions = {},
) {
  // 前置：双帧缺一 -> 无可比，不保留。
  if (!previous || !next) {
    return false;
  }
  // [I2] 新帧已终态 -> 永远落地，不保留旧帧。
  if (isJobTerminal(next) || (isTerminalStatus(next.status) && next.status !== "succeeded")) {
    return false;
  }
  // [I3] 换 job_id = 新一轮重试 -> 绝不继承旧终态/旧进度。
  // 重试/再翻译会换 job_id：这是新一轮，绝不能继承旧终态（否则主页卡卡在「已翻译」不转圈）
  if (!sameRuntimeJobId(previous, next)) {
    return false;
  }
  // [I2] 同 job 终态后偶发非终态脏轮询：保留终态，避免卡片回退
  if (isJobTerminal(previous) && !isJobTerminal(next)) {
    return true;
  }
  // [I1] active 盖过 queued 回退。
  if (`${next.status || ""}`.trim() === "queued" && isRecentJobActive(previous)) {
    return true;
  }
  // [I1] 不同 stage 不可比 -> 不保留（让新帧落地，进度单调性只在同 stage 内断言）。
  const previousStage = stageKeyForPatch(previous, stageAdapterPort);
  const nextStage = stageKeyForPatch(next, stageAdapterPort);
  if (!previousStage || !nextStage) {
    return false;
  }
  if (previousStage !== nextStage) {
    return false;
  }
  // [I1] 同 stage 下 unit/total 必须一致且合法，否则不可比。
  const previousProgress = progressOfPatch(previous);
  const nextProgress = progressOfPatch(next);
  const previousUnit = firstNonEmpty(previousProgress.unit, previous.progress_unit);
  const nextUnit = firstNonEmpty(nextProgress.unit, next.progress_unit);
  if (!previousUnit || !nextUnit) {
    return false;
  }
  if (previousUnit !== nextUnit) {
    return false;
  }
  const previousTotal = finiteProgressOrNull(previousProgress.total ?? previous.progress_total);
  const nextTotal = finiteProgressOrNull(nextProgress.total ?? next.progress_total);
  if (previousTotal === null || nextTotal === null) {
    return false;
  }
  if (previousTotal !== nextTotal || previousTotal <= 0) {
    return false;
  }
  // [I1] 同口径下 current 倒退 -> 保留旧帧（运行态不降级）。
  const previousCurrent = finiteProgressOrNull(previousProgress.current ?? previous.progress_current);
  const nextCurrent = finiteProgressOrNull(nextProgress.current ?? next.progress_current);
  if (previousCurrent === null || nextCurrent === null) {
    return false;
  }
  return previousCurrent > nextCurrent;
}

function identityFieldsFromPrevious(
  previous: RuntimeJobPatch = {},
  next: RuntimeJobPatch = {},
): Partial<RuntimeJobPatch> {
  // 换 job_id 时仍保留书目身份，避免轮询包缺字段时补丁丢 document_id/封面
  return {
    document_id: firstNonEmpty(next.document_id, previous.document_id) || undefined,
    title: firstNonEmpty(next.title, previous.title) || undefined,
    display_name: firstNonEmpty(next.display_name, previous.display_name, next.title, previous.title) || undefined,
    cover_url: firstNonEmpty(next.cover_url, previous.cover_url) || undefined,
    thumbnail_url: firstNonEmpty(next.thumbnail_url, previous.thumbnail_url) || undefined,
    page_count: next.page_count ?? previous.page_count,
  };
}

export function mergeRuntimePatch(
  previous: RuntimeJobPatch | null = null,
  next: RuntimeJobPatch = {},
  { stageAdapterPort = {} }: RuntimePatchMergeOptions = {},
): RuntimeJobPatch {
  // 前置：无旧帧 -> 直接采用新帧。
  if (!previous) {
    return next;
  }
  // [I3] 新 job（重试）: 全量采用 next 的运行态，只继承书目身份字段
  if (!sameRuntimeJobId(previous, next)) {
    return {
      ...next,
      ...identityFieldsFromPrevious(previous, next),
    };
  }
  // 同 job 且无需保留旧帧 -> 采用新运行态 + 继承书目身份（[I2] 新终态走这里落地）。
  if (!shouldKeepPreviousRuntimePatch(previous, next, { stageAdapterPort })) {
    return {
      ...next,
      ...identityFieldsFromPrevious(previous, next),
    };
  }
  // 以下仅同 job_id 且旧帧更新（[I1]/[I2] 保留分支）：旧 status/snapshot/progress 覆盖新帧。
  const previousProgress = progressOfPatch(previous);
  // 仅同 job_id 才可能保留旧 status（终态防回退 / active 盖过 queued / 空状态不降级）
  const previousTerminal = isJobTerminal(previous) && !isJobTerminal(next); // [I2]
  const previousActiveOverQueued = `${next.status || ""}`.trim() === "queued" && isRecentJobActive(previous); // [I1]
  // 空状态刷新（后端写库滞后）绝不能把运行中的卡刷成静态：保留旧运行态直到真数据到
  const nextStatusEmpty = `${next.status || ""}`.trim() === ""; // [I1]
  const previousActiveOverEmpty = nextStatusEmpty && isRecentJobActive(previous);
  const keepPreviousRuntimeState = previousTerminal || previousActiveOverQueued || previousActiveOverEmpty;
  const nextStageSnapshot = next.stage_snapshot && typeof next.stage_snapshot === "object"
    ? {
      ...next.stage_snapshot,
      progress: {
        ...(next.stage_snapshot.progress && typeof next.stage_snapshot.progress === "object"
          ? next.stage_snapshot.progress
          : {}),
        ...previousProgress,
      },
    }
    : null;
  return {
    ...next,
    ...identityFieldsFromPrevious(previous, next),
    ...(keepPreviousRuntimeState
      ? {
        status: previous.status,
        display_stage: previous.display_stage ?? next.display_stage,
        stage: previous.stage ?? next.stage,
        substage: previous.substage ?? next.substage,
        lane: previous.lane ?? next.lane,
        stage_detail: previous.stage_detail ?? next.stage_detail,
      }
      : {}),
    stage_snapshot: keepPreviousRuntimeState ? previous.stage_snapshot || next.stage_snapshot : nextStageSnapshot || next.stage_snapshot,
    progress: {
      ...(next.progress && typeof next.progress === "object" ? next.progress : {}),
      ...previousProgress,
    },
    progress_current: previousProgress.current ?? previous.progress_current ?? next.progress_current,
    progress_total: previousProgress.total ?? previous.progress_total ?? next.progress_total,
    progress_unit: previousProgress.unit ?? previous.progress_unit ?? next.progress_unit,
  };
}

/** 补丁必须带上原卡书目身份，否则终态 refresh 会把「换 id 的重试」当成新建空壳卡 prepend */
export function stampBookIdentity(
  patch: RuntimeJobPatch,
  previousItem: LibraryJobItem | null | undefined,
  job: RuntimeJobPatch | LibraryJobItem,
): RuntimeJobPatch {
  const prev = previousItem || {};
  const currentJobId = firstNonEmpty(patch.job_id, job.job_id);
  // source_job_id 仅表示「重试前的旧 job」；不可写成当前 id 自己
  const rawSource = firstNonEmpty(
    (patch as RuntimeJobPatch).source_job_id,
    (job as RuntimeJobPatch).source_job_id,
    // 仅当就地换 id 时才把旧 job_id 记作 source
    (prev.job_id && currentJobId && prev.job_id !== currentJobId ? prev.job_id : ""),
  );
  const sourceJobId = rawSource && rawSource !== currentJobId ? rawSource : undefined;
  return {
    ...patch,
    document_id: firstNonEmpty(patch.document_id, job.document_id, prev.document_id) || undefined,
    title: firstNonEmpty(patch.title, job.title, prev.title) || undefined,
    display_name: firstNonEmpty(patch.display_name, job.display_name, prev.display_name, prev.title) || undefined,
    cover_url: firstNonEmpty(patch.cover_url, job.cover_url, prev.cover_url) || undefined,
    thumbnail_url: firstNonEmpty(patch.thumbnail_url, job.thumbnail_url, prev.thumbnail_url) || undefined,
    page_count: patch.page_count ?? job.page_count ?? prev.page_count,
    source_job_id: sourceJobId,
  };
}
