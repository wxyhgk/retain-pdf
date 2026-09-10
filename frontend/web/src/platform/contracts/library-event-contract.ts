import { APP_EVENTS } from "./app-contract.js";

export const LIBRARY_REFRESH_MIN_INTERVAL_MS = 4000;

export interface LibraryRefreshDetailInput {
  delay?: number | string;
  force?: boolean;
  [key: string]: unknown;
}

export interface LibraryJobDetailInput {
  job?: unknown;
  [key: string]: unknown;
}

export interface CreateLibraryEventPortOptions {
  target?: EventTarget;
}

export interface RequestLibraryRefreshOptions {
  delay?: number | string;
  force?: boolean;
}

export interface SubscribeLibraryEventsOptions {
  onRefreshRequested?: (detail: ReturnType<typeof normalizeLibraryRefreshDetail>) => void;
  onJobUpdated?: (detail: ReturnType<typeof normalizeLibraryJobDetail>) => void;
  onJobCreated?: (detail: ReturnType<typeof normalizeLibraryJobDetail>) => void;
}

export interface LibraryRefreshThrottleState {
  lastLibraryRefreshRequestedAt?: number;
  [key: string]: unknown;
}

export interface RequestThrottledLibraryRefreshOptions {
  port?: {
    requestRefresh?: (options?: RequestLibraryRefreshOptions) => void;
  };
  terminal?: boolean;
}

export function normalizeLibraryRefreshDetail(detail: LibraryRefreshDetailInput = {}) {
  const delay = Number(detail?.delay);
  return {
    delay: Number.isFinite(delay) ? delay : undefined,
    force: Boolean(detail?.force),
  };
}

export function normalizeLibraryJobDetail(detail: LibraryJobDetailInput = {}) {
  return {
    job: detail?.job || null,
  };
}

export function createLibraryEventPort({ target = document }: CreateLibraryEventPortOptions = {}) {
  return {
    requestRefresh({ delay, force = false }: RequestLibraryRefreshOptions = {}) {
      target.dispatchEvent(new CustomEvent(APP_EVENTS.libraryRefreshRequested, {
        detail: {
          delay: Number.isFinite(Number(delay)) ? Number(delay) : undefined,
          force: Boolean(force),
        },
      }));
    },

    publishJobUpdated(job) {
      if (!job) {
        return;
      }
      target.dispatchEvent(new CustomEvent(APP_EVENTS.libraryJobUpdated, {
        detail: { job },
      }));
    },

    publishJobCreated(job) {
      if (!job) {
        return;
      }
      target.dispatchEvent(new CustomEvent(APP_EVENTS.libraryJobCreated, {
        detail: { job },
      }));
    },

    subscribe({
      onRefreshRequested,
      onJobUpdated,
      onJobCreated,
    }: SubscribeLibraryEventsOptions = {}) {
      const handlers: Array<[string, EventListener]> = [
        [
          APP_EVENTS.libraryRefreshRequested,
          (event: CustomEvent) => onRefreshRequested?.(normalizeLibraryRefreshDetail(event.detail)),
        ],
        [
          APP_EVENTS.libraryJobUpdated,
          (event: CustomEvent) => onJobUpdated?.(normalizeLibraryJobDetail(event.detail)),
        ],
        [
          APP_EVENTS.libraryJobCreated,
          (event: CustomEvent) => onJobCreated?.(normalizeLibraryJobDetail(event.detail)),
        ],
      ];
      handlers.forEach(([eventName, handler]) => {
        target.addEventListener(eventName, handler);
      });
      return {
        destroy() {
          handlers.forEach(([eventName, handler]) => {
            target.removeEventListener(eventName, handler);
          });
        },
      };
    },
  };
}

export function requestThrottledLibraryRefresh(
  state: LibraryRefreshThrottleState,
  {
    port = createLibraryEventPort(),
    terminal = false,
  }: RequestThrottledLibraryRefreshOptions = {},
) {
  const now = Date.now();
  const minInterval = terminal ? 0 : LIBRARY_REFRESH_MIN_INTERVAL_MS;
  if (!terminal && state.lastLibraryRefreshRequestedAt && now - state.lastLibraryRefreshRequestedAt < minInterval) {
    return false;
  }
  state.lastLibraryRefreshRequestedAt = now;
  port.requestRefresh({ delay: terminal ? 200 : 800 });
  return true;
}
