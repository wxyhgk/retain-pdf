import {
  summarizeStageDetail,
  summarizeStageKey,
  summarizeStageLabel,
  summarizeStageProgressText,
  progressFromText,
  stageSubtypeOf,
} from "./job-status-summary.js";
import {
  ocrProgressFallbackForRawStage,
  rawStageOfPayload,
  visualStageKeyForRawStage,
} from "./job-stage-contract.js";

function stageRank(stageKey) {
  return {
    queued: 0,
    ocr: 1,
    translate: 2,
    render: 3,
    done: 4,
  }[stageKey] ?? 0;
}

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const num = numberOrNull(value);
    if (num !== null) {
      return num;
    }
  }
  return null;
}

function strongestStageKey(...payloads) {
  return payloads
    .map((payload) => summarizeStageKey(payload || {}))
    .filter(Boolean)
    .reduce((best, key) => stageRank(key) > stageRank(best) ? key : best, "");
}

function keepForwardStageKey(job, eventPayload, eventsPayload) {
  const jobStageKey = strongestStageKey(job, eventsPayload?.live_stage);
  const eventStageKey = summarizeStageKey(eventPayload);
  return stageRank(eventStageKey) >= stageRank(jobStageKey) ? eventStageKey : jobStageKey;
}

function latestStageEvent(job, eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const currentStage = `${job?.current_stage || job?.stage || ""}`.trim();
  const currentStageKey = summarizeStageKey(job);
  const findMatchingEvent = (allowBroadStage, requireProgress = false) => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index] || {};
      const itemStage = `${item.stage || ""}`.trim();
      const providerStage = `${item.provider_stage || ""}`.trim();
      const itemStageForMatch = itemStage || providerStage;
      if (!itemStageForMatch) {
        continue;
      }
      const progress = progressFromEvent(item);
      if (requireProgress && (progress.current === null || progress.total === null)) {
        continue;
      }
      const itemPayload = {
        ...job,
        current_stage: itemStageForMatch,
        stage_detail: item.stage_detail || item.message || "",
        progress_current: progress.current,
        progress_total: progress.total,
      };
      const itemStageKey = summarizeStageKey(itemPayload);
      if (currentStage) {
        const exactMatch = itemStageForMatch === currentStage;
        if (!exactMatch && (!allowBroadStage || itemStageKey !== currentStageKey)) {
          continue;
        }
      } else if (currentStageKey && itemStageKey !== currentStageKey) {
        continue;
      }
      if (!item.stage_detail && !item.message && progress.current === null) {
        continue;
      }
      return item;
    }
    return null;
  };
  const exactEvent = findMatchingEvent(false);
  if (currentStageKey === "translate") {
    const broadEvent = findMatchingEvent(true, true) || findMatchingEvent(true);
    if (broadEvent) {
      return broadEvent;
    }
  }
  if (exactEvent) {
    return exactEvent;
  }
  return findMatchingEvent(true);
}

function progressFromEvent(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const current = firstNumber(
    event?.progress_current,
    payload.progress_current,
    payload.current,
    payload.current_page,
    payload.extracted_pages,
    payload.extractedPages,
    payload.page_number,
    payload.page,
  );
  const total = firstNumber(
    event?.progress_total,
    payload.progress_total,
    payload.total,
    payload.total_pages,
    payload.totalPages,
    payload.page_count,
    payload.pages,
  );
  return { current, total };
}

function stagePayloadFromEvent(job, item, progress) {
  return {
    ...job,
    status: item?.status || "running",
    user_stage: item?.user_stage || item?.payload?.user_stage || "",
    current_stage: item?.stage || item?.provider_stage || "",
    stage: item?.stage || "",
    substage: item?.substage || item?.payload?.substage || "",
    stage_detail: item?.stage_detail || item?.message || "",
    progress_unit: item?.progress_unit || item?.payload?.progress_unit || "",
    progress_current: progress.current,
    progress_total: progress.total,
  };
}

function progressUnitPriority(unit = "") {
  switch (`${unit || ""}`.trim()) {
    case "page":
    case "batch":
      return 3;
    case "percent":
      return 2;
    case "step":
      return 1;
    default:
      return 0;
  }
}

function visualStageKeyForEventPayload(payload = {}, stageKey = "") {
  return visualStageKeyForRawStage(rawStageOfPayload(payload), stageKey);
}

function shouldReplaceStageProgress(previous, next) {
  if (!previous) {
    return true;
  }
  if (
    next.current > 0
    && next.total > 0
    && next.current >= next.total
    && (next.progressUnit === "page" || next.progressUnit === "none" || next.visualStageKey === "ocr_result_ready")
  ) {
    return true;
  }
  const previousPriority = progressUnitPriority(previous.progressUnit);
  const nextPriority = progressUnitPriority(next.progressUnit);
  if (nextPriority !== previousPriority) {
    return nextPriority > previousPriority;
  }
  return true;
}

export function collectStageProgressByKey(job, eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const progressByKey = {};
  for (const item of items) {
    const itemStage = `${item?.stage || item?.provider_stage || ""}`.trim();
    if (!itemStage) {
      continue;
    }
    const progress = progressFromEvent(item);
    if (progress.current === null || progress.total === null || progress.total <= 0) {
      continue;
    }
    const payload = stagePayloadFromEvent(job, { ...item, stage: itemStage }, progress);
    const stageKey = summarizeStageKey(payload);
    if (!["ocr", "translate", "render"].includes(stageKey)) {
      continue;
    }
    const visualStageKey = visualStageKeyForEventPayload(payload, stageKey);
    const progressUnit = stageKey === "ocr"
      && visualStageKey === "ocr_result_ready"
      && progress.current > 0
      && progress.total > 0
      ? "page"
      : payload.progress_unit;
    const displayPayload = {
      ...payload,
      progress_unit: progressUnit,
    };
    const nextProgress = {
      current: progress.current,
      total: progress.total,
      progressText: summarizeStageProgressText(displayPayload),
      progressUnit,
      visualStageKey,
      substageKey: stageSubtypeOf(displayPayload),
      indeterminate: stageKey === "ocr" && progress.current <= 0 && progress.total > 0,
    };
    if (shouldReplaceStageProgress(progressByKey[stageKey], nextProgress)) {
      progressByKey[stageKey] = nextProgress;
    }
  }
  return progressByKey;
}

function jobProgress(job = {}) {
  const textProgress = progressFromText(job);
  const current = firstNumber(job?.progress_current, job?.progress?.current);
  const total = firstNumber(job?.progress_total, job?.progress?.total);
  return {
    current: current ?? textProgress.current,
    total: total ?? textProgress.total,
  };
}

function stageProgressMatches(stageKey, eventPayload) {
  return Boolean(stageKey) && summarizeStageKey(eventPayload) === stageKey;
}

function stageFallbackProgress(stageKey, job = {}) {
  return stageKey === "ocr" ? ocrProgressFallbackForRawStage(rawStageOfPayload(job)) : null;
}

function visualStageKeyFor(job = {}, stageKey = "") {
  return visualStageKeyForRawStage(rawStageOfPayload(job), stageKey);
}

export function resolveDisplayedStagePresentation(job, eventsPayload) {
  const fallbackProgress = jobProgress(job);
  const fallbackStageKey = summarizeStageKey(job);
  const stageFallback = stageFallbackProgress(fallbackStageKey, job);
  const fallback = {
    stageKey: fallbackStageKey,
    visualStageKey: visualStageKeyFor(job, fallbackStageKey),
    label: summarizeStageLabel(job),
    detail: summarizeStageDetail(job),
    progressText: summarizeStageProgressText(job) || stageFallback?.text || "",
    progressCurrent: fallbackProgress.current ?? stageFallback?.current ?? null,
    progressTotal: fallbackProgress.total ?? stageFallback?.total ?? null,
    substageKey: stageSubtypeOf(job),
    progressIndeterminate: fallbackProgress.current === null && fallbackProgress.total === null && Boolean(stageFallback),
  };
  const event = latestStageEvent(job, eventsPayload);
  if (!event) {
    return fallback;
  }
  const eventProgress = progressFromEvent(event);
  const rawEventPayload = {
    ...job,
    status: job.status,
    user_stage: event.user_stage || event.payload?.user_stage || "",
    current_stage: event.stage || event.provider_stage || job.current_stage || job.stage || "",
    substage: event.substage || event.payload?.substage || "",
    stage_detail: event.stage_detail || event.message || job.stage_detail || "",
    progress_unit: event.progress_unit || event.payload?.progress_unit || "",
    progress_current: eventProgress.current,
    progress_total: eventProgress.total,
  };
  const eventMatchesCurrentStage = stageProgressMatches(fallback.stageKey, rawEventPayload);
  const progress = {
    current: eventProgress.current ?? (eventMatchesCurrentStage ? fallbackProgress.current : null),
    total: eventProgress.total ?? (eventMatchesCurrentStage ? fallbackProgress.total : null),
  };
  const eventPayload = {
    ...rawEventPayload,
    progress_current: progress.current ?? stageFallback?.current ?? null,
    progress_total: progress.total ?? stageFallback?.total ?? null,
  };
  const eventProgressText = summarizeStageProgressText(eventPayload);
  const stageKey = keepForwardStageKey(job, eventPayload, eventsPayload);
  return {
    stageKey,
    visualStageKey: visualStageKeyFor(eventPayload, stageKey),
    label: stageKey === summarizeStageKey(eventPayload) ? summarizeStageLabel(eventPayload) : summarizeStageLabel(job),
    detail: summarizeStageDetail(eventPayload),
    progressText: eventProgressText || stageFallback?.text || "",
    progressCurrent: eventPayload.progress_current,
    progressTotal: eventPayload.progress_total,
    substageKey: stageSubtypeOf(eventPayload),
    progressIndeterminate: eventProgress.current === null && eventProgress.total === null && Boolean(stageFallback),
  };
}
