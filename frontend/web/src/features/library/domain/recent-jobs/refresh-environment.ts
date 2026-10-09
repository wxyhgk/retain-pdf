import {
  defaultRecentJobsWorkflowOpenPort,
} from "./workflow-open-port.js";

export function createRecentJobsRefreshEnvironment({
  now = () => Date.now(),
  setTimeoutFn = (callback, delay) => window.setTimeout(callback, delay),
  clearTimeoutFn = (timer) => window.clearTimeout(timer ?? undefined),
  workflowOpenPort = defaultRecentJobsWorkflowOpenPort,
  isWorkflowOpen = () => workflowOpenPort.isWorkflowOpen(),
}: {
  now?: () => number;
  setTimeoutFn?: (callback: () => void, delay: number) => number;
  clearTimeoutFn?: (timer: number | null | undefined) => void;
  workflowOpenPort?: typeof defaultRecentJobsWorkflowOpenPort;
  isWorkflowOpen?: () => boolean;
} = {}) {
  return Object.freeze({
    now,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    isWorkflowOpen,
  });
}

export const defaultRecentJobsRefreshEnvironment = createRecentJobsRefreshEnvironment();
