// Runtime 补丁状态机：insert/update/apply/applyExisting 四入口。
//
// 四入口：
// - insert(job): 前置 job_id 非空 + isPrimaryRecentJob；优先级：已存在同卡 -> 降级为
//   update（就地合并，绝不 prepend 第二张）；全新文档 + hasStableLibraryIdentity 才
//   prepend，否则只缓存补丁 + scheduleActiveRefresh 等 soft refresh 补齐投影。
// - update(job): 前置 job_id 非空；优先级：按卡身份找原卡 -> mergeRuntimePatch 合并
//   运行态 -> stampBookIdentity 补书目身份 -> replaceItem 整表回写；找不到原卡且
//   active + 有书目身份才回退 insert，否则只留补丁。
// - apply(items): 前置 items 可空（按 [] 处理）；优先级：mergeRuntimePatches 先并表
//   -> 仅全新文档（不在表 + 无 source_job_id 血缘 + 有稳定身份）才 prepend 创建帧。
// - applyExisting(items): 前置同 apply；只做 mergeRuntimePatches，不 prepend（给
//   load-more / 追加页用，避免把创建帧重复插进第二页）。

import { isRecentJobActive } from "./card-presenter.js";
import { invalidateRecentJobImages } from "./image-refresh.js";
import { findLibraryCardIndex } from "./library-card-identity.js";
import { isPrimaryRecentJob } from "./pagination.js";
import {
  createLibraryJobItemFromRuntime,
  mergeLibraryJobItem,
  mergeRuntimePatches,
} from "./runtime-item.js";
import {
  hasStableLibraryIdentity,
  mergeRuntimePatch,
  stampBookIdentity,
  type RuntimeJobPatch,
} from "./runtime-patch-merge.js";
import { firstNonEmpty } from "./runtime-value-helpers.js";
import type { LibraryJobItem, StageAdapterPort } from "./runtime-item-types.js";
import type { RecentJobsStatePort } from "./state.js";

export interface RuntimePatchCommandsDeps {
  scheduleActiveRefresh?: (options?: { resetTimer?: boolean }) => void;
  stageAdapterPort?: StageAdapterPort;
  statePort: Pick<
    RecentJobsStatePort,
    "getSnapshot" | "replaceItem" | "prependItem" | "setHasMore"
  >;
}

export interface RuntimePatchCommands {
  apply: (items: LibraryJobItem[] | null | undefined) => LibraryJobItem[];
  applyExisting: (items: LibraryJobItem[] | null | undefined) => LibraryJobItem[];
  insert: (job: RuntimeJobPatch | LibraryJobItem) => void;
  update: (job: RuntimeJobPatch | LibraryJobItem) => void;
}

export function createRuntimePatchCommands({
  scheduleActiveRefresh,
  stageAdapterPort,
  statePort,
}: RuntimePatchCommandsDeps): RuntimePatchCommands {
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

  function update(job: RuntimeJobPatch | LibraryJobItem) {
    // 前置 P0：无 job_id 直接丢弃（早返）。
    const jobId = `${job?.job_id || ""}`.trim();
    if (!jobId) {
      return;
    }
    // P1 按卡身份定位原卡；换 id 时取旧 patch 做 [I3] 身份继承源。
    const state = statePort.getSnapshot();
    const index = findLibraryCardIndex(state.items, job);
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
    const existingIndex = findLibraryCardIndex(state.items, job);
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
    scheduleActiveRefresh?.({ resetTimer: false });
  }

  return {
    apply,
    applyExisting,
    insert,
    update,
  };
}
