import {
  eventStageForMatchRecord,
  normalizedStageEventRecord,
} from "../job-stage-event-record.js";
import {
  normalizeProgressRecordFromEventRecord,
} from "../contract/job-stage-progress-record-normalizer.js";
import type { JobLike, JobPayload } from "../../job/types.js";
import type { EventsPayload, ProgressRecord } from "../types.js";

export type ProgressReplaceFn = (
  previous: ProgressRecord | null | undefined,
  next: ProgressRecord | null | undefined,
) => boolean;

export interface SelectRenderProgressRecordsOptions {
  shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
}

export interface RenderProgressRecords {
  refine?: ProgressRecord | null;
  prepare?: ProgressRecord | null;
  prewarm?: ProgressRecord | null;
  pages?: ProgressRecord | null;
  compile?: ProgressRecord | null;
}

export interface CompositeRenderProgressFromEventsOptions {
  fallbackProgress?: ProgressRecord | null;
  shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
}

function clampRatio(current: number, total: number) {
  return Math.max(0, Math.min(1, current / total));
}

function validProgress(record: ProgressRecord | null | undefined) {
  return Boolean(record && record.current !== null && record.total !== null && record.total > 0);
}

export function compositeRenderCompileProgress(record: ProgressRecord | null | undefined) {
  const hasProgress = validProgress(record);
  if (!record || !hasProgress) {
    if (record?.substageKey !== "render_compile") {
      return null;
    }
  }
  if (!record) {
    return null;
  }
  const compileRatio = hasProgress ? clampRatio(Number(record.current), Number(record.total)) : 0;
  const percent = 80 + Math.round(compileRatio * 20);
  const compileDone = hasProgress && Number(record.current) >= Number(record.total);
  const compileText = compileDone ? "渲染完成" : "正在编译 PDF";
  const payload = (record.payload && typeof record.payload === "object")
    ? record.payload as Record<string, unknown>
    : {};
  return {
    ...record,
    current: percent,
    total: 100,
    progressUnit: "percent",
    displayPercent: percent,
    progressText: compileText,
    payload: {
      ...payload,
      stage_detail: compileText,
      progress_unit: "percent",
    },
    indeterminate: false,
  };
}

export function compositeRenderPageProgress(record: ProgressRecord | null | undefined) {
  if (!validProgress(record) || !record) {
    return null;
  }
  const pageRatio = clampRatio(Number(record.current), Number(record.total));
  const percent = 10 + Math.round(pageRatio * 70);
  const payload = (record.payload && typeof record.payload === "object")
    ? record.payload as Record<string, unknown>
    : {};
  return {
    ...record,
    current: percent,
    total: 100,
    progressUnit: "percent",
    displayPercent: percent,
    progressText: record.progressText,
    payload: {
      ...payload,
      progress_unit: "percent",
    },
    indeterminate: Number(record.current) <= 0,
  };
}

export function compositeRenderPrewarmProgress(record: ProgressRecord | null | undefined) {
  if (!validProgress(record) || !record) {
    return null;
  }
  const prewarmRatio = clampRatio(Number(record.current), Number(record.total));
  const percent = Math.round(prewarmRatio * 10);
  const prewarmText = `预热 ${record.current}/${record.total}`;
  const payload = (record.payload && typeof record.payload === "object")
    ? record.payload as Record<string, unknown>
    : {};
  return {
    ...record,
    current: percent,
    total: 100,
    progressUnit: "percent",
    displayPercent: percent,
    progressText: prewarmText,
    payload: {
      ...payload,
      stage_detail: prewarmText,
      progress_unit: "percent",
    },
    indeterminate: Number(record.current) <= 0,
  };
}

const REFINE_PHASE_TEXT: Record<string, string> = {
  start: "正在准备精修",
  prepare: "正在准备精修",
  review: "正在挑错",
  fix: "正在修改有问题的译文",
  done: "精修完成",
};

export function refinePhaseText(record: ProgressRecord | null | undefined): string {
  const payload = (record?.payload && typeof record.payload === "object")
    ? record.payload as Record<string, unknown>
    : {};
  // 后端把 refine_phase 写在事件自己的 payload 里；归一化后原始事件在 record.item，
  // record.payload 是重新拼过的展示载荷，几处都认。
  const item = (record?.item && typeof record.item === "object")
    ? record.item as Record<string, unknown>
    : {};
  const itemPayload = (item.payload && typeof item.payload === "object")
    ? item.payload as Record<string, unknown>
    : {};
  const phase = `${itemPayload.refine_phase || item.refine_phase || payload.refine_phase || ""}`.trim();
  return REFINE_PHASE_TEXT[phase] || "正在精修译文";
}

/**
 * 精修排在 render_prepare 之前，而 prepare 占 0–10%。精修要调模型、耗时没法按比例估，
 * 给它百分比的话进入 prepare 时进度条会倒退，所以精修期间进度条是「不定」状态、
 * 停在 0，只靠文案说明在挑错还是在改。
 */
export function compositeRenderRefineProgress(record: ProgressRecord | null | undefined) {
  if (!record) {
    return null;
  }
  const phaseText = refinePhaseText(record);
  const counted = validProgress(record) && Number(record.total) > 1
    ? `${phaseText}（${record.current}/${record.total}）`
    : phaseText;
  const payload = (record.payload && typeof record.payload === "object")
    ? record.payload as Record<string, unknown>
    : {};
  return {
    ...record,
    current: 0,
    total: 100,
    progressUnit: "percent",
    displayPercent: 0,
    progressText: counted,
    payload: {
      ...payload,
      stage_detail: counted,
      progress_unit: "percent",
    },
    indeterminate: true,
  };
}

export function compositeRenderPrepareProgress(record: ProgressRecord | null | undefined) {
  if (!validProgress(record) || !record) {
    return null;
  }
  const prepareRatio = clampRatio(Number(record.current), Number(record.total));
  const percent = Math.round(prepareRatio * 10);
  const payload = (record.payload && typeof record.payload === "object")
    ? record.payload as Record<string, unknown>
    : {};
  return {
    ...record,
    current: percent,
    total: 100,
    progressUnit: "percent",
    displayPercent: percent,
    progressText: `准备 ${record.current}/${record.total}`,
    payload: {
      ...payload,
      progress_unit: "percent",
    },
    indeterminate: Number(record.current) <= 0,
  };
}

function shouldTrackRenderRecord(
  record: ProgressRecord | null | undefined,
  substageKey: string,
  progressUnit: string,
) {
  return record?.substageKey === substageKey && record?.progressUnit === progressUnit;
}

function selectRenderProgressRecords(
  job: JobLike | JobPayload | null | undefined,
  eventsPayload: EventsPayload | null | undefined,
  {
    shouldReplaceCurrentStageProgress,
  }: SelectRenderProgressRecordsOptions = {},
): RenderProgressRecords {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  let latestRefineProgress: ProgressRecord | null = null;
  let latestPrepareProgress: ProgressRecord | null = null;
  let latestPrewarmProgress: ProgressRecord | null = null;
  let latestPageProgress: ProgressRecord | null = null;
  let latestCompileProgress: ProgressRecord | null = null;
  for (const item of items) {
    const record = normalizedStageEventRecord(item);
    if (!record.isMainLane) {
      continue;
    }
    const itemStage = eventStageForMatchRecord(record);
    if (!itemStage) {
      continue;
    }
    const next = normalizeProgressRecordFromEventRecord(job, record, itemStage);
    if (!next || next.stageKey !== "render") {
      continue;
    }
    if (
      next.substageKey === "refining"
      && shouldReplaceCurrentStageProgress!(latestRefineProgress, next)
    ) {
      latestRefineProgress = next;
    }
    if (
      shouldTrackRenderRecord(next, "render_prepare", "step")
      && shouldReplaceCurrentStageProgress!(latestPrepareProgress, next)
    ) {
      latestPrepareProgress = next;
    }
    if (
      shouldTrackRenderRecord(next, "render_prewarm", "step")
      && shouldReplaceCurrentStageProgress!(latestPrewarmProgress, next)
    ) {
      latestPrewarmProgress = next;
    }
    if (next.progressUnit === "page" && shouldReplaceCurrentStageProgress!(latestPageProgress, next)) {
      latestPageProgress = next;
    }
    if (
      shouldTrackRenderRecord(next, "render_compile", "step")
      && shouldReplaceCurrentStageProgress!(latestCompileProgress, next)
    ) {
      latestCompileProgress = next;
    }
  }
  return {
    refine: latestRefineProgress,
    prepare: latestPrepareProgress,
    prewarm: latestPrewarmProgress,
    pages: latestPageProgress,
    compile: latestCompileProgress,
  };
}

export function compositeRenderProgressFromRecords(
  records: RenderProgressRecords = {},
  fallbackProgress: ProgressRecord | null = null,
) {
  return compositeRenderCompileProgress(records.compile)
    || compositeRenderPageProgress(records.pages)
    || compositeRenderPrewarmProgress(records.prewarm)
    || compositeRenderPrepareProgress(records.prepare)
    || compositeRenderRefineProgress(records.refine)
    || records.compile
    || records.pages
    || records.prewarm
    || records.prepare
    || fallbackProgress
    || null;
}

export function compositeRenderProgressFromEvents(
  job: JobLike | JobPayload | null | undefined,
  eventsPayload: EventsPayload | null | undefined,
  {
    fallbackProgress = null,
    shouldReplaceCurrentStageProgress,
  }: CompositeRenderProgressFromEventsOptions = {},
) {
  const records = selectRenderProgressRecords(job, eventsPayload, {
    shouldReplaceCurrentStageProgress,
  });
  return compositeRenderProgressFromRecords(records, fallbackProgress);
}
