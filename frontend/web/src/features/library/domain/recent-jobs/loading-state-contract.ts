export const RECENT_JOBS_LOADING_STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

export function createNoopRecentJobsHomeStatePort() {
  return Object.freeze({
    setRecentJobsLoadingState() {},
  });
}
