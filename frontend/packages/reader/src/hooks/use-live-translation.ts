import { useEffect, useRef, useState } from "react";
import {
  LiveTranslationApiError,
  fetchLiveTranslationLayout,
  fetchLiveTranslationPage,
  streamLiveTranslationEvents,
  type LiveTranslationCommitEvent,
  type LiveTranslationPageSnapshot,
} from "@retainpdf/api/live-translation";
import {
  EMPTY_LIVE_TRANSLATION_STATE,
  applyLiveTranslationSnapshot,
  decideLiveTranslationSnapshot,
  layoutPageMap,
  type LiveTranslationState,
} from "../shared/data/live-translation-state.js";

const LAYOUT_RETRY_MS = [250, 500, 1_000, 2_000, 4_000];
const SNAPSHOT_RETRY_MS = [80, 160, 320, 640, 1_000, 1_500];
const STREAM_RETRY_MS = [250, 500, 1_000, 2_000, 4_000, 5_000];
const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled"]);

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof LiveTranslationApiError) {
    if (error.code === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED") {
      return "尚未收到可显示的页面译文";
    }
    if (error.code === "LIVE_TRANSLATION_LAYOUT_NOT_READY") {
      return "正在等待 OCR 版面数据";
    }
  }
  const message = `${(error as Error)?.message || ""}`.trim();
  return message || fallback;
}

async function fetchMatchingPage(
  jobId: string,
  event: LiveTranslationCommitEvent,
  current: LiveTranslationState,
  signal: AbortSignal,
): Promise<LiveTranslationPageSnapshot> {
  let lastError: unknown = null;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const snapshot = await fetchLiveTranslationPage(jobId, event.page_idx, { signal });
      if (decideLiveTranslationSnapshot(current.pagesByPage.get(event.page_idx), event, snapshot) !== "retry") {
        return snapshot;
      }
      lastError = new LiveTranslationApiError(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
      );
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      lastError = error;
      const code = error instanceof LiveTranslationApiError ? error.code : "";
      if (code && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
      ].includes(code)) throw error;
    }
    const delay = SNAPSHOT_RETRY_MS[Math.min(attempt, SNAPSHOT_RETRY_MS.length - 1)];
    await wait(delay, signal);
    if (attempt >= SNAPSHOT_RETRY_MS.length + 2) throw lastError;
  }
}

export type UseLiveTranslationOptions = {
  jobId: string;
  /** Authoritative status owned and refreshed by the Reader session. */
  jobStatus: string;
  enabled: boolean;
};

export function useLiveTranslation({
  jobId,
  jobStatus,
  enabled,
}: UseLiveTranslationOptions): LiveTranslationState {
  const [state, setState] = useState<LiveTranslationState>(EMPTY_LIVE_TRANSLATION_STATE);
  const stateRef = useRef(state);
  const stateJobIdRef = useRef("");
  stateRef.current = state;

  const normalizedJobId = `${jobId || ""}`.trim();
  const normalizedJobStatus = `${jobStatus || ""}`.trim().toLowerCase();
  const terminalStatus = TERMINAL_JOB_STATUSES.has(normalizedJobStatus)
    ? normalizedJobStatus
    : "";

  useEffect(() => {
    if (!enabled || !normalizedJobId) {
      stateJobIdRef.current = "";
      stateRef.current = EMPTY_LIVE_TRANSLATION_STATE;
      setState(EMPTY_LIVE_TRANSLATION_STATE);
      return;
    }

    const sameJob = stateJobIdRef.current === normalizedJobId;
    stateJobIdRef.current = normalizedJobId;
    const abort = new AbortController();
    let layoutReady = false;
    // A failed/cancelled translation is a paused pipeline, not a failed reader.
    // Keep already committed pages and replay durable SSE history on a fresh load.
    const connectingState: LiveTranslationState = {
      ...(sameJob ? stateRef.current : EMPTY_LIVE_TRANSLATION_STATE),
      connection: terminalStatus ? "terminal" : "connecting",
      jobStatus: normalizedJobStatus,
      error: "",
    };
    stateRef.current = connectingState;
    setState(connectingState);

    const publish = (updater: (current: LiveTranslationState) => LiveTranslationState) => {
      if (abort.signal.aborted) return;
      setState((current) => {
        const next = updater(current);
        stateRef.current = next;
        return next;
      });
    };

    const loadLayout = async () => {
      let retry = 0;
      while (!abort.signal.aborted) {
        try {
          const layout = await fetchLiveTranslationLayout(normalizedJobId, { signal: abort.signal });
          layoutReady = true;
          publish((current) => ({
            ...current,
            layoutByPage: layoutPageMap(layout),
            jobStatus: normalizedJobStatus,
            error: "",
          }));
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
          const canRetry = error instanceof LiveTranslationApiError
            && error.code === "LIVE_TRANSLATION_LAYOUT_NOT_READY";
          if (!canRetry) {
            publish((current) => ({
              ...current,
              connection: terminalStatus ? "terminal" : "unavailable",
              jobStatus: normalizedJobStatus,
              error: errorMessage(error, "实时译文暂不可用"),
            }));
            return;
          }
          if (terminalStatus) {
            publish((current) => ({
              ...current,
              connection: "terminal",
              jobStatus: normalizedJobStatus,
              error: "",
            }));
            return;
          }
          publish((current) => ({
            ...current,
            connection: "connecting",
            jobStatus: normalizedJobStatus,
            error: errorMessage(error, "正在等待 OCR 版面数据"),
          }));
          await wait(LAYOUT_RETRY_MS[Math.min(retry, LAYOUT_RETRY_MS.length - 1)], abort.signal).catch(() => {});
          retry += 1;
        }
      }
    };

    const stream = async () => {
      await loadLayout();
      if (!layoutReady || abort.signal.aborted) return;
      let reconnect = 0;
      while (!abort.signal.aborted) {
        if (!terminalStatus) {
          publish((current) => ({
            ...current,
            connection: current.lastSeq > 0 ? "reconnecting" : "connecting",
            jobStatus: normalizedJobStatus,
            error: current.lastSeq > 0 ? current.error : "",
          }));
        }
        try {
          await streamLiveTranslationEvents(normalizedJobId, {
            afterSeq: stateRef.current.lastSeq,
            signal: abort.signal,
            onEvent: async (event) => {
              if (event.seq <= stateRef.current.lastSeq) return;
              const snapshot = await fetchMatchingPage(
                normalizedJobId,
                event,
                stateRef.current,
                abort.signal,
              );
              publish((current) => {
                const next = applyLiveTranslationSnapshot(current, event, snapshot);
                return terminalStatus
                  ? {
                    ...next,
                    connection: "terminal",
                    jobStatus: normalizedJobStatus,
                  }
                  : {
                    ...next,
                    jobStatus: normalizedJobStatus,
                  };
              });
              reconnect = 0;
            },
          });
        } catch (error) {
          if ((error as Error)?.name === "AbortError" || abort.signal.aborted) return;
          publish((current) => ({
            ...current,
            connection: terminalStatus ? "terminal" : "reconnecting",
            jobStatus: normalizedJobStatus,
            error: errorMessage(error, "实时译文连接已中断，正在重连"),
          }));
        }
        if (abort.signal.aborted) return;
        if (terminalStatus) {
          publish((current) => ({
            ...current,
            connection: "terminal",
            jobStatus: normalizedJobStatus,
          }));
          return;
        }
        await wait(STREAM_RETRY_MS[Math.min(reconnect, STREAM_RETRY_MS.length - 1)], abort.signal).catch(() => {});
        reconnect += 1;
      }
    };

    void stream();
    return () => abort.abort();
  }, [enabled, normalizedJobId, terminalStatus]);

  return state;
}
