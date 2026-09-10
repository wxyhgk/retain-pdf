import {
  defaultRecentJobsWorkflowOpenPort,
} from "./workflow-open-port.js";

export function createRecentJobsRefreshEnvironment({
  now = () => Date.now(),
  setTimeoutFn = (callback, delay) => window.setTimeout(callback, delay),
  clearTimeoutFn = (timer) => window.clearTimeout(timer),
  workflowOpenPort = defaultRecentJobsWorkflowOpenPort,
  isWorkflowOpen = () => workflowOpenPort.isWorkflowOpen(),
}: any = {}) {
  return Object.freeze({
    now,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    isWorkflowOpen,
  });
}

export const defaultRecentJobsRefreshEnvironment = createRecentJobsRefreshEnvironment();
