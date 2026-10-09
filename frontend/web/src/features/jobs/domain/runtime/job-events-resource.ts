import { createResource } from "@/platform/store/resource.js";
import { fetchJobEventPages, mergeJobEventPages, validateJobEventsPage } from "@retainpdf/api/jobs-events";
import type { fetchJobEvents as FetchJobEvents } from "@retainpdf/api/jobs-events";
import type { JobEventListView } from "@retainpdf/contracts/job-events";

/** 单个任务的事件流会话（游标 + 退避状态） */
interface JobEventsSession {
  mode: "recent" | "all";
  payload: JobEventListView | null;
  failures: number;
  retryAt: number;
  error?: unknown;
}

export const JOB_EVENTS_PAGE_SIZE = 500;
export const JOB_EVENTS_PREVIEW_PAGE_SIZE = 500;

export async function fetchAllJobEvents({ fetchJobEvents, apiPrefix, jobId, isCurrent }: {
  fetchJobEvents: typeof FetchJobEvents;
  apiPrefix?: string;
  jobId: string;
  isCurrent?: () => boolean;
}) {
  return fetchJobEventPages({ fetchPage: fetchJobEvents, apiPrefix, jobId,
    query: { limit: JOB_EVENTS_PAGE_SIZE, start: "head" }, isCurrent });
}

export async function fetchRecentJobEvents({ fetchJobEvents, apiPrefix, jobId }: {
  fetchJobEvents: typeof FetchJobEvents;
  apiPrefix?: string;
  jobId: string;
}) {
  return validateJobEventsPage(await fetchJobEvents(jobId, apiPrefix,
    { limit: JOB_EVENTS_PREVIEW_PAGE_SIZE, start: "tail" }));
}

export function mergeJobEventsPayload(previousPayload: JobEventListView | null, nextPayload: JobEventListView): JobEventListView {
  return mergeJobEventPages(previousPayload, nextPayload);
}

/** 事件流资源的依赖：拉取接口 + API 前缀 + 历史模式（recent / all）+ 时钟（测试注入） */
export interface JobEventsResourceOptions {
  fetchJobEvents: typeof FetchJobEvents;
  apiPrefix?: string;
  mode?: "recent" | "all";
  now?: () => number;
}

export function createJobEventsResource({ fetchJobEvents, apiPrefix, mode = "recent",
  now = () => Date.now() }: JobEventsResourceOptions = {} as JobEventsResourceOptions) {
  // Cursor belongs to a task and a history mode, not the currently selected UI.
  const sessions = new Map<string, JobEventsSession>();
  let revision = 0;
  const resource = createResource({
    name: `jobEvents:${mode}`,
    cacheKey: ({ jobId = "", terminal = false } = {}) => JSON.stringify({
      jobId, mode: terminal || mode === "all" ? "all" : "recent",
    }),
    loader: async ({ jobId = "", terminal = false, isCurrent = () => true, onReset = () => {} }: {
      jobId?: string;
      terminal?: boolean;
      isCurrent?: () => boolean;
      onReset?: () => void;
    } = {}) => {
      const id = `${jobId}`.trim();
      if (!id) throw new Error("缺少 job_id，无法加载事件流。");
      const historyMode = terminal || mode === "all" ? "all" : "recent";
      let session = sessions.get(id);
      if (!session || session.mode !== historyMode) {
        session = { mode: historyMode, payload: null, failures: 0, retryAt: 0 };
        sessions.set(id, session);
      }
      if (now() < session.retryAt) throw session.error;
      const requestRevision = revision;
      const current = () => revision === requestRevision && sessions.get(id) === session && isCurrent();
      const initialQuery = { limit: JOB_EVENTS_PAGE_SIZE, start: historyMode === "all" ? "head" : "tail" } as const;
      const read = (query) => fetchJobEventPages({ fetchPage: fetchJobEvents,
        jobId: id, apiPrefix, query, isCurrent: current });
      try {
        let next: JobEventListView;
        try {
          next = await read(session.payload
            ? { limit: JOB_EVENTS_PAGE_SIZE, cursor: session.payload.next_cursor }
            : initialQuery);
        } catch (error) {
          if (error?.status !== 410 || error?.code !== "EVENT_CURSOR_EXPIRED" || !current()) throw error;
          session.payload = null;
          onReset();
          // Reset only this event feed. A second expiry is surfaced with normal backoff.
          next = await read(initialQuery);
        }
        if (!current()) throw new DOMException("Event load canceled", "AbortError");
        session.payload = mergeJobEventsPayload(session.payload, next);
        session.failures = 0;
        session.retryAt = 0;
        return session.payload;
      } catch (error) {
        if (current() && error?.name !== "AbortError") {
          session.failures += 1;
          session.retryAt = now() + Math.min(30_000, 1000 * 2 ** (session.failures - 1));
          session.error = error;
        }
        throw error;
      }
    },
  });
  return Object.freeze({
    ...resource,
    hasFullHistory(jobId) {
      const session = sessions.get(jobId);
      return session?.mode === "all" && Boolean(session.payload);
    },
    invalidate(params = null) {
      if (params) sessions.delete(params.jobId);
      else { revision += 1; sessions.clear(); }
      resource.invalidate(params);
    },
    reset() {
      revision += 1;
      sessions.clear();
      resource.reset();
    },
  });
}

export type JobEventsResource = ReturnType<typeof createJobEventsResource>;
