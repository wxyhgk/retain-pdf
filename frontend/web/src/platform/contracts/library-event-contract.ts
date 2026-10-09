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
  bypassThrottle?: boolean;
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
  const normalized: { delay?: number; force: boolean; bypassThrottle?: boolean } = {
    delay: Number.isFinite(delay) ? delay : undefined,
    force: Boolean(detail?.force),
  };
  if (detail?.bypassThrottle) normalized.bypassThrottle = true;
  return normalized;
}

export function normalizeLibraryJobDetail(detail: LibraryJobDetailInput = {}) {
  return {
    job: detail?.job || null,
  };
}

export function createLibraryEventPort({ target = document }: CreateLibraryEventPortOptions = {}) {
  return {
    requestRefresh({ delay, force = false, bypassThrottle = false }: RequestLibraryRefreshOptions = {}) {
      target.dispatchEvent(new CustomEvent(APP_EVENTS.libraryRefreshRequested, {
        detail: {
          delay: Number.isFinite(Number(delay)) ? Number(delay) : undefined,
          force: Boolean(force),
          ...(bypassThrottle ? { bypassThrottle: true } : null),
        },
      }));
    },

    publishJobUpdated(job: unknown) {
      if (!job) {
        return;
      }
      target.dispatchEvent(new CustomEvent(APP_EVENTS.libraryJobUpdated, {
        detail: { job },
      }));
    },

    publishJobCreated(job: unknown) {
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
        // EventListener 收到的是 Event；这些事件都由 CustomEvent 派发，detail 形状由各自的 normalize 兜底。
        [
          APP_EVENTS.libraryRefreshRequested,
          (event: Event) => {
            onRefreshRequested?.(normalizeLibraryRefreshDetail((event as CustomEvent<LibraryRefreshDetailInput>).detail));
          },
        ],
        [
          APP_EVENTS.libraryJobUpdated,
          (event: Event) => {
            onJobUpdated?.(normalizeLibraryJobDetail((event as CustomEvent<LibraryJobDetailInput>).detail));
          },
        ],
        [
          APP_EVENTS.libraryJobCreated,
          (event: Event) => {
            onJobCreated?.(normalizeLibraryJobDetail((event as CustomEvent<LibraryJobDetailInput>).detail));
          },
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
  // requestRefresh 可缺省（端口只接发布侧时）：缺省则不刷新，但节流时间戳照常记下。
  port.requestRefresh?.({ delay: terminal ? 200 : 800 });
  return true;
}
