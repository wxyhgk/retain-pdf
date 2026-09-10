import { createCommandBus } from "@/platform/store/commands.js";
import type { LibraryJobItem } from "./runtime-item.js";

export const RECENT_JOBS_COMMANDS = Object.freeze({
  refreshRequested: "library:refresh",
  jobUpdated: "library:job-updated",
  jobCreated: "library:job-created",
});

export interface RecentJobsRefreshRequest {
  delay?: number;
  force?: boolean;
  bypassThrottle?: boolean;
  [key: string]: unknown;
}

export interface RecentJobsJobCommandPayload {
  job?: LibraryJobItem | null;
}

export interface RecentJobsCommandSubscribeHandlers {
  onRefreshRequested?: (payload?: RecentJobsRefreshRequest) => void;
  onJobUpdated?: (payload?: RecentJobsJobCommandPayload) => void;
  onJobCreated?: (payload?: RecentJobsJobCommandPayload) => void;
}

export type RecentJobsCommandBus = {
  on: (
    command: string,
    handler: (payload?: unknown, meta?: { command?: string }) => unknown,
  ) => () => void;
  dispatch: (command: string, payload?: unknown) => Promise<unknown[]> | unknown[];
  clear?: (command?: string) => void;
};

export interface CreateRecentJobsCommandPortOptions {
  commands?: RecentJobsCommandBus;
}

export interface RecentJobsCommandSubscription {
  destroy: () => void;
}

export type RecentJobsCommandDispatchResult = Promise<unknown[]> | unknown[];

export interface RecentJobsCommandPort {
  commands: RecentJobsCommandBus;
  publishJobCreated: (job?: LibraryJobItem | null) => RecentJobsCommandDispatchResult;
  publishJobUpdated: (job?: LibraryJobItem | null) => RecentJobsCommandDispatchResult;
  requestRefresh: (detail?: RecentJobsRefreshRequest) => RecentJobsCommandDispatchResult;
  subscribe: (
    handlers?: RecentJobsCommandSubscribeHandlers,
  ) => RecentJobsCommandSubscription;
}

export function createRecentJobsCommandPort({
  commands = createCommandBus() as RecentJobsCommandBus,
}: CreateRecentJobsCommandPortOptions = {}): RecentJobsCommandPort {
  function requestRefresh(detail: RecentJobsRefreshRequest = {}) {
    return commands.dispatch(RECENT_JOBS_COMMANDS.refreshRequested, {
      delay: Number.isFinite(Number(detail.delay)) ? Number(detail.delay) : undefined,
      force: Boolean(detail.force),
    }) as RecentJobsCommandDispatchResult;
  }

  function publishJobUpdated(job?: LibraryJobItem | null) {
    if (!job) {
      return Promise.resolve([]);
    }
    return commands.dispatch(RECENT_JOBS_COMMANDS.jobUpdated, { job }) as RecentJobsCommandDispatchResult;
  }

  function publishJobCreated(job?: LibraryJobItem | null) {
    if (!job) {
      return Promise.resolve([]);
    }
    return commands.dispatch(RECENT_JOBS_COMMANDS.jobCreated, { job }) as RecentJobsCommandDispatchResult;
  }

  function subscribe({
    onRefreshRequested,
    onJobUpdated,
    onJobCreated,
  }: RecentJobsCommandSubscribeHandlers = {}): RecentJobsCommandSubscription {
    const unsubscribers = [
      commands.on(RECENT_JOBS_COMMANDS.refreshRequested, (payload) => (
        onRefreshRequested?.(payload as RecentJobsRefreshRequest)
      )),
      commands.on(RECENT_JOBS_COMMANDS.jobUpdated, (payload) => (
        onJobUpdated?.(payload as RecentJobsJobCommandPayload)
      )),
      commands.on(RECENT_JOBS_COMMANDS.jobCreated, (payload) => (
        onJobCreated?.(payload as RecentJobsJobCommandPayload)
      )),
    ];
    return {
      destroy() {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      },
    };
  }

  return Object.freeze({
    commands,
    publishJobCreated,
    publishJobUpdated,
    requestRefresh,
    subscribe,
  });
}
