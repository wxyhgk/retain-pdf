import { createResource } from "@/platform/store/resource.js";

export const JOB_EVENTS_PAGE_SIZE = 200;
export const JOB_EVENTS_PREVIEW_PAGE_SIZE = 500;

export async function fetchAllJobEvents({ fetchJobEvents, apiPrefix, jobId }: any) {
  const items = [];
  let offset = 0;
  while (true) {
    const payload = await fetchJobEvents(jobId, apiPrefix, JOB_EVENTS_PAGE_SIZE, offset);
    const batch = Array.isArray(payload?.items) ? payload.items : [];
    items.push(...batch);
    if (batch.length < JOB_EVENTS_PAGE_SIZE) {
      return {
        ...payload,
        items,
        offset: 0,
        limit: items.length,
      };
    }
    offset += batch.length;
  }
}

export async function fetchRecentJobEvents({ fetchJobEvents, apiPrefix, jobId }: any) {
  let offset = 0;
  let latestPayload = await fetchJobEvents(jobId, apiPrefix, JOB_EVENTS_PREVIEW_PAGE_SIZE, offset);
  let batch = Array.isArray(latestPayload?.items) ? latestPayload.items : [];
  while (batch.length >= JOB_EVENTS_PREVIEW_PAGE_SIZE) {
    offset += batch.length;
    const nextPayload = await fetchJobEvents(jobId, apiPrefix, JOB_EVENTS_PREVIEW_PAGE_SIZE, offset);
    const nextBatch = Array.isArray(nextPayload?.items) ? nextPayload.items : [];
    if (nextBatch.length === 0) {
      return latestPayload;
    }
    latestPayload = nextPayload;
    batch = nextBatch;
  }
  return latestPayload;
}

export function mergeJobEventsPayload(previousPayload, nextPayload) {
  const previousItems = Array.isArray(previousPayload?.items) ? previousPayload.items : [];
  const nextItems = Array.isArray(nextPayload?.items) ? nextPayload.items : [];
  const byKey = new Map();
  [...previousItems, ...nextItems].forEach((item, index) => {
    const seq = Number(item?.seq);
    const eventKeyParts = [
      item?.lane,
      item?.display_stage,
      item?.stage,
      item?.substage,
      item?.event_type,
      item?.progress?.unit,
      item?.created_at || item?.ts,
    ].map((value) => `${value || ""}`.trim()).join(":");
    const key = Number.isFinite(seq)
      ? `seq:${seq}:${eventKeyParts}`
      : `idx:${item?.created_at || item?.ts || ""}:${index}`;
    byKey.set(key, item);
  });
  const items = Array.from(byKey.values()).sort((left, right) => {
    const leftSeq = Number(left?.seq);
    const rightSeq = Number(right?.seq);
    if (Number.isFinite(leftSeq) && Number.isFinite(rightSeq) && leftSeq !== rightSeq) {
      return leftSeq - rightSeq;
    }
    const leftTime = Date.parse(left?.created_at || left?.ts || "");
    const rightTime = Date.parse(right?.created_at || right?.ts || "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return 0;
  });
  return {
    ...previousPayload,
    ...nextPayload,
    items,
    offset: 0,
    limit: items.length,
  };
}

export function createJobEventsResource({
  fetchJobEvents,
  apiPrefix,
  mode = "recent",
}: any = {}) {
  const fetchMode = mode === "all" ? "all" : "recent";
  return createResource({
    name: `jobEvents:${fetchMode}`,
    cacheKey: ({ jobId = "", terminal = false } = {}) => JSON.stringify({
      jobId: `${jobId || ""}`.trim(),
      mode: terminal || fetchMode === "all" ? "all" : "recent",
    }),
    loader: async ({ jobId = "", terminal = false } = {}) => {
      const resolvedJobId = `${jobId || ""}`.trim();
      if (!resolvedJobId) {
        return {
          items: [],
          offset: 0,
          limit: 0,
        };
      }
      const loadAll = terminal || fetchMode === "all";
      return loadAll
        ? fetchAllJobEvents({ fetchJobEvents, apiPrefix, jobId: resolvedJobId })
        : fetchRecentJobEvents({ fetchJobEvents, apiPrefix, jobId: resolvedJobId });
    },
  });
}
