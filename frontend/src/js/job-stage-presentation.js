import {
  summarizeStageDetail,
  summarizeStageKey,
  summarizeStageLabel,
  summarizeStageProgressText,
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

function jobProgress(job = {}) {
  return {
    current: firstNumber(job?.progress_current, job?.progress?.current),
    total: firstNumber(job?.progress_total, job?.progress?.total),
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
  };
  const event = latestStageEvent(job, eventsPayload);
  if (!event) {
    return fallback;
  }
  const eventProgress = progressFromEvent(event);
  const rawEventPayload = {
    ...job,
    status: job.status,
    current_stage: event.stage || event.provider_stage || job.current_stage || job.stage || "",
    stage_detail: event.stage_detail || event.message || job.stage_detail || "",
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
  };
}
