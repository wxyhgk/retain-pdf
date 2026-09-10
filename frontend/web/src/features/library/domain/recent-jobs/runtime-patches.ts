import { isRecentJobActive } from "./card-presenter.js";
import { invalidateRecentJobImages } from "./image-refresh.js";
import { isPrimaryRecentJob } from "./pagination.js";
import {
  createLibraryJobItemFromRuntime,
  mergeLibraryJobItem,
  mergeRuntimePatches,
  type LibraryJobItem,
  type StageAdapterPort,
  type StageProgress,
  type StageSnapshot,
} from "./runtime-item.js";
import {
  clampRuntimeStageKeyForJob,
  firstNonEmpty,
  isJobTerminal,
  isTerminalStatus,
  normalizeRuntimeDisplayStage,
  numberOrNull,
} from "./runtime-value-helpers.js";
import type { RecentJobsStatePort } from "./state.js";
import { findLibraryCardIndex } from "./library-card-identity.js";

/**
 * 合并规则显性化（不改行为，只写清前置条件与优先级）。
 *
 * 四入口：
 * - insert(job): 前置 job_id 非空 + isPrimaryRecentJob；优先级：已存在同卡 -> 降级为
 *   update（就地合并，绝不 prepend 第二张）；全新文档 + hasStableLibraryIdentity 才
 *   prepend，否则只缓存补丁 + scheduleActiveRefresh 等 soft refresh 补齐投影。
 * - update(job): 前置 job_id 非空；优先级：按卡身份找原卡 -> mergeRuntimePatch 合并
 *   运行态 -> stampBookIdentity 补书目身份 -> replaceItem 整表回写；找不到原卡且
 *   active + 有书目身份才回退 insert，否则只留补丁。
 * - apply(items): 前置 items 可空（按 [] 处理）；优先级：mergeRuntimePatches 先并表
 *   -> 仅全新文档（不在表 + 无 source_job_id 血缘 + 有稳定身份）才 prepend 创建帧。
 * - applyExisting(items): 前置同 apply；只做 mergeRuntimePatches，不 prepend（给
 *   load-more / 追加页用，避免把创建帧重复插进第二页）。
 *
 * 三条不变式：
 * - [I1 运行态不降级] active 盖过 queued/空状态，同 stage+unit+total 下 current 不倒退。
 * - [I2 终态优先] 同 job_id 终态后到非终态脏轮询一律保留终态；新终态永远可落地。
 * - [I3 换 id 继承身份] 重试换 job_id 时只继承书目身份（document_id/title/封面），
 *   绝不继承旧运行态/旧终态；旧 patch 键必须删除，避免双卡。
 *
 * 单元测试断言（均已存在，不删）：tests/library/recent-jobs*.test.mjs 断言单调进度 /
 * 终态覆盖脏轮询 / 重试走 replaceItem；tests/home/submit-spinning-guarantee.test.mjs
 * 断言提交即 queued 转圈 / 空状态不降级 / 终态正常落地。
 */

/** Runtime job patch: library item plus optional flat progress fields from polling. */
export interface RuntimeJobPatch extends LibraryJobItem {
  progress_current?: number | null;
  progress_total?: number | null;
  progress_unit?: string | null;
  stage_snapshot?: StageSnapshot | null;
}

export interface RuntimePatchMergeOptions {
  stageAdapterPort?: StageAdapterPort;
}

export interface RecentJobsRuntimePatchesDeps {
  renderCurrentRecentJobs: (options?: { reset?: boolean }) => void;
  replaceRecentJobCard: (item: LibraryJobItem) => boolean;
  scheduleActiveRefresh?: (options?: { resetTimer?: boolean }) => void;
  stageAdapterPort?: StageAdapterPort;
  statePort: Pick<
    RecentJobsStatePort,
    "getSnapshot" | "replaceItem" | "prependItem" | "setHasMore"
  >;
  storeDrivenRendering?: boolean;
}

export interface RecentJobsRuntimePatches {
  apply: (items: LibraryJobItem[] | null | undefined) => LibraryJobItem[];
  applyExisting: (items: LibraryJobItem[] | null | undefined) => LibraryJobItem[];
  insert: (job: RuntimeJobPatch | LibraryJobItem) => void;
  update: (job: RuntimeJobPatch | LibraryJobItem) => void;
}

const IGNORED_SNAPSHOT_SOURCES = new Set(["legacy-stage", "canonical-empty-stage"]);
const PATCH_STAGE_KEYS = new Set(["ocr", "translate", "render", "done"]);

/**
 * 书架以 document 为身份，不能把只有 job_id 的提交首帧当成一本新书。
 * `/jobs` 的创建响应目前不保证返回 document_id；真正的文档投影会由
 * `/documents` 的 soft refresh 补齐。在此之前只缓存运行补丁，不渲染空壳卡。
 */
function hasStableLibraryIdentity(job: RuntimeJobPatch | LibraryJobItem = {}) {
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
  const previousTotal = numberOrNull(previousProgress.total ?? previous.progress_total);
  const nextTotal = numberOrNull(nextProgress.total ?? next.progress_total);
  if (previousTotal === null || nextTotal === null) {
    return false;
  }
  if (previousTotal !== nextTotal || previousTotal <= 0) {
    return false;
  }
  // [I1] 同口径下 current 倒退 -> 保留旧帧（运行态不降级）。
  const previousCurrent = numberOrNull(previousProgress.current ?? previous.progress_current);
  const nextCurrent = numberOrNull(nextProgress.current ?? next.progress_current);
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

function mergeRuntimePatch(
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

export function createRecentJobsRuntimePatches({
  renderCurrentRecentJobs,
  replaceRecentJobCard,
  scheduleActiveRefresh,
  stageAdapterPort,
  statePort,
  storeDrivenRendering = false,
}: RecentJobsRuntimePatchesDeps): RecentJobsRuntimePatches {
  const runtimeJobPatches = new Map<string, RuntimeJobPatch>();
  const runtimeCreatedJobIds = new Set<string>();

  function apply(items: LibraryJobItem[] | null | undefined) {
    // 前置：items 可空（mergeRuntimePatches 内部按 [] 处理）。
    // 优先级 P1 先把 patches 按统一卡片 identity 并进列表项（重试换 job_id 时不丢原卡）
    const mergedItems = mergeRuntimePatches(items, runtimeJobPatches, { stageAdapterPort });
    // P2 仅「全新文档」才 prepend；同一 document 已在列表里绝不再插第二张。
    // 带 source_job_id 的是阶段重试血缘，绝不能当新书插（否则主页多一张 job_id 空壳）。
    // P3 无稳定书目身份（缺 document_id/真书名）只留补丁不渲染（[I3]）。
    const missingCreatedItems = Array.from(runtimeCreatedJobIds)
      .filter((createdJobId: string) => {
        const patch = runtimeJobPatches.get(createdJobId);
        if (!patch) return false;
        if (findLibraryCardIndex(mergedItems, patch) >= 0) return false;
        if (`${(patch as RuntimeJobPatch)?.source_job_id || ""}`.trim()) return false;
        return hasStableLibraryIdentity(patch);
      })
      .map((createdJobId) => createLibraryJobItemFromRuntime(runtimeJobPatches.get(createdJobId), { stageAdapterPort }))
      .filter(Boolean);
    return [...missingCreatedItems, ...mergedItems];
  }

  function applyExisting(items: LibraryJobItem[] | null | undefined) {
    // 前置同 apply；只合并不 prepend（load-more 追加页专用，避免创建帧被插进第二页）。
    return mergeRuntimePatches(items, runtimeJobPatches, { stageAdapterPort });
  }

  function findItemIndex(
    items: LibraryJobItem[],
    job: RuntimeJobPatch | LibraryJobItem,
  ) {
    return findLibraryCardIndex(items, job);
  }

  /** 补丁必须带上原卡书目身份，否则终态 refresh 会把「换 id 的重试」当成新建空壳卡 prepend */
  function stampBookIdentity(
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

  function update(job: RuntimeJobPatch | LibraryJobItem) {
    // 前置 P0：无 job_id 直接丢弃（早返）。
    const jobId = `${job?.job_id || ""}`.trim();
    if (!jobId) {
      return;
    }
    // P1 按卡身份定位原卡；换 id 时取旧 patch 做 [I3] 身份继承源。
    const state = statePort.getSnapshot();
    const index = findItemIndex(state.items, job);
    const previousJobId = index >= 0
      ? `${state.items[index]?.job_id || ""}`.trim()
      : "";
    const previousItem = index >= 0 ? state.items[index] : null;
    // 补丁 map：重试换 id 时把旧 patch 并过来；再盖上原卡书目身份
    const previousPatch = previousJobId && previousJobId !== jobId
      ? runtimeJobPatches.get(previousJobId)
      : runtimeJobPatches.get(jobId);
    const merged = mergeRuntimePatch(previousPatch || previousItem, job, { stageAdapterPort });
    const patch = stampBookIdentity(merged, previousItem, job);
    runtimeJobPatches.set(jobId, patch);
    // P2 换 id 收尾：删旧 patch 键 + 旧 created 标记（[I3] 防双卡）；就地改原卡不标 created。
    if (previousJobId && previousJobId !== jobId) {
      runtimeJobPatches.delete(previousJobId);
      runtimeCreatedJobIds.delete(previousJobId);
      // 就地改原卡：绝不能标成 created，否则 soft refresh 会 prepend 一张 job_id 空壳
    }
    // P3 找不到原卡：仅 active + 有书目身份才回退 insert，否则只留补丁等投影（[I1] 防空壳卡）。
    if (index < 0) {
      // 仍找不到原卡时：若带 document_id 但补丁缺书名，不要 insert 空壳
      // （否则主页会出现「转圈 + job_id」占位卡，原书还在）
      const title = `${patch.title || patch.display_name || ""}`.trim();
      const hasBookIdentity = Boolean(
        `${patch.document_id || ""}`.trim()
        && title
        && !/^mock-/i.test(title)
        && title !== jobId
        && title !== `${jobId}.pdf`,
      );
      if (isRecentJobActive(patch) && hasBookIdentity) {
        insert(patch);
      }
      return;
    }
    const nextItem = mergeLibraryJobItem(previousItem || {}, {
      ...patch,
      job_id: jobId,
      source_job_id: undefined,
      library_only: false,
      active_job_id: jobId,
      document_id: firstNonEmpty(patch.document_id, previousItem?.document_id),
    }, { stageAdapterPort });
    // 再写回补丁，保证 refresh 合并时有 document_id/真书名
    runtimeJobPatches.set(jobId, stampBookIdentity(patch, nextItem, job));
    invalidateRecentJobImages(previousItem || {}, nextItem);
    // replaceItem 与运行时补丁共用同一 identity，重试换 id 不再绕过 store 整表回写。
    statePort.replaceItem(nextItem);
    if (!storeDrivenRendering && !replaceRecentJobCard(nextItem)) {
      renderCurrentRecentJobs({ reset: true });
    }
    scheduleActiveRefresh?.({ resetTimer: false });
  }

  function insert(job: RuntimeJobPatch | LibraryJobItem) {
    // 前置 P0：非主任务（ocr 子任务等）直接丢弃；无 job_id 直接丢弃（早返）。
    if (!isPrimaryRecentJob(job)) {
      return;
    }
    const jobId = `${job?.job_id || ""}`.trim();
    if (!jobId) {
      return;
    }
    // P1 核心：有 document_id / source_job_id 且书架已有该书 → 就地 update，绝不 prepend 新卡
    const state = statePort.getSnapshot();
    const existingIndex = findItemIndex(state.items, job);
    if (existingIndex >= 0) {
      const previousJobId = `${state.items[existingIndex]?.job_id || ""}`.trim();
      update({
        ...job,
        source_job_id: `${(job as RuntimeJobPatch)?.source_job_id || previousJobId || ""}`.trim() || undefined,
        document_id: job.document_id || state.items[existingIndex]?.document_id,
      });
      return;
    }
    const nextItem = createLibraryJobItemFromRuntime(job, { stageAdapterPort });
    // P2 建卡失败（缺 job_id）-> 早返。
    if (!nextItem) {
      return;
    }
    // P3 首帧无 document_id 时仍保留补丁：文档列表刷新并带上同一 active job 后，
    // apply() 会把这份进度合并回原书；但这里绝不能 prepend job_id 空壳。
    // 提交即转圈：裸提交包可能没有 status/stage，存入 map 前先钉成 queued，
    // 否则首轮轮询/水合回来之前的刷新会把卡片画成静态。
    const queuedFirstFrame = {
      ...job,
      status: firstNonEmpty((job as RuntimeJobPatch)?.status, "queued"),
      stage: firstNonEmpty((job as RuntimeJobPatch)?.stage, "queued"),
    };
    runtimeJobPatches.set(nextItem.job_id, queuedFirstFrame);
    // P4 无稳定书目身份只缓存 + 触发主动刷新，不 prepend（[I3] 防空壳卡）。
    if (!hasStableLibraryIdentity(nextItem)) {
      scheduleActiveRefresh?.({ resetTimer: false });
      return;
    }
    // P5 全新文档才 prepend + 记 created，供 apply() 补齐。
    runtimeCreatedJobIds.add(nextItem.job_id);
    statePort.prependItem(nextItem);
    statePort.setHasMore(state.hasMore);
    if (!storeDrivenRendering) {
      renderCurrentRecentJobs({ reset: true });
    }
    scheduleActiveRefresh?.({ resetTimer: false });
  }

  return {
    apply,
    applyExisting,
    insert,
    update,
  };
}
