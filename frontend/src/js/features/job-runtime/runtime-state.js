export const JOB_EVENTS_PAGE_SIZE = 200;
export const JOB_POLL_INTERVAL_MS = 1000;
export const JOB_EVENTS_REFRESH_MS = 1000;
export const JOB_MANIFEST_REFRESH_MS = 5000;

export function stopPolling(state) {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

export async function fetchAllJobEvents({ fetchJobEvents, apiPrefix, jobId }) {
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

export function cachedEventsFor(state, jobId) {
  return state.currentJobEventsJobId === jobId ? state.currentJobEvents : null;
}

export function cachedManifestFor(state, jobId) {
  return state.currentJobManifestJobId === jobId ? state.currentJobManifest : null;
}

export function shouldRefreshSecondary(lastFetchedAt, refreshMs, force) {
  if (force) {
    return true;
  }
  if (!Number.isFinite(lastFetchedAt) || lastFetchedAt <= 0) {
    return true;
  }
  return (Date.now() - lastFetchedAt) >= refreshMs;
}
