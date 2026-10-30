// Cursor feed v2. Translation live-events SSE keeps its separate protocol.
import type {
  EditorialEventListView,
  EditorialEventsQuery,
  JobEventListView,
  ListJobEventsQuery,
} from "@retainpdf/contracts/job-events";
import * as generated from "./generated/job-events.js";

export type JobEventsQuery = ListJobEventsQuery & { signal?: AbortSignal };

export class JobEventsError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "JobEventsError";
  }
}

export function validateJobEventsPage(payload: unknown): JobEventListView {
  const page = payload as JobEventListView | null;
  if (!page || page.protocol_version !== 2 || !Array.isArray(page.items)
    || typeof page.next_cursor !== "string" || !page.next_cursor
    || typeof page.has_more !== "boolean" || !Number.isInteger(page.limit)
    || page.limit < 1 || page.limit > 500 || page.items.length > page.limit
    || page.items.some(item => !item || typeof item.event_id !== "string" || !item.event_id
      || !Number.isSafeInteger(item.seq) || item.seq < 1)) {
    throw new JobEventsError("事件流协议不匹配，请更新客户端与后端。", 0, "EVENT_PROTOCOL_MISMATCH");
  }
  return page;
}

export function mergeJobEventPages(previous: { items?: JobEventListView["items"] } | null, next: JobEventListView): JobEventListView {
  const byId = new Map<string, JobEventListView["items"][number]>();
  for (const item of [...(previous?.items || []), ...next.items]) {
    if (!item?.event_id) throw new JobEventsError("Event v2 records require event_id", 0, "EVENT_PROTOCOL_MISMATCH");
    byId.set(item.event_id, item);
  }
  const items = Array.from(byId.values()).sort((left, right) => {
    const leftTime = Date.parse(left.created_at || left.ts);
    const rightTime = Date.parse(right.created_at || right.ts);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
    return left.seq - right.seq;
  });
  return { ...next, items };
}

export async function fetchJobEvents(
  jobId: string,
  apiPrefix?: string,
  query: JobEventsQuery = {},
): Promise<JobEventListView> {
  if (typeof query !== "object" || query === null || "offset" in query
    || (query.cursor !== undefined && query.start !== undefined)) {
    throw new JobEventsError("事件流使用 start 或 cursor，不支持 offset。", 400, "INVALID_QUERY");
  }
  const feedQuery: ListJobEventsQuery = query.cursor !== undefined
    ? { limit: query.limit ?? 500, cursor: query.cursor }
    : { limit: query.limit ?? 500, start: query.start ?? "tail" };
  // OCR 任务也走 /jobs/:id/progress/events（后端已统一），不再 404 后退到 /ocr/jobs/ 别名。
  const page = await generated.listJobEvents(apiPrefix, { job_id: jobId, query: feedQuery }, {
    signal: query.signal,
    onError: (status, payload) => new JobEventsError(
      payload?.message || `读取事件流失败，请稍后重试。(${status})`,
      status,
      payload?.error?.code || "EVENT_REQUEST_FAILED",
    ),
  });
  return validateJobEventsPage(page);
}

/** Drain only the fixed batch encoded by a cursor; never chase a moving head. */
export async function fetchJobEventPages({
  fetchPage = fetchJobEvents,
  jobId,
  apiPrefix,
  query = { start: "head" },
  isCurrent = () => true,
}: {
  fetchPage?: typeof fetchJobEvents;
  jobId: string;
  apiPrefix?: string;
  query?: JobEventsQuery;
  isCurrent?: () => boolean;
}): Promise<JobEventListView> {
  const items: JobEventListView["items"] = [];
  let nextQuery = query;
  while (true) {
    if (!isCurrent() || query.signal?.aborted) throw new DOMException("Event load canceled", "AbortError");
    const page = validateJobEventsPage(await fetchPage(jobId, apiPrefix, nextQuery));
    if (!isCurrent() || query.signal?.aborted) throw new DOMException("Event load canceled", "AbortError");
    items.push(...page.items);
    if (!page.has_more) return mergeJobEventPages(null, { ...page, items });
    if (page.next_cursor === nextQuery.cursor) {
      throw new JobEventsError("事件游标没有前进。", 0, "EVENT_PROTOCOL_MISMATCH");
    }
    nextQuery = { limit: query.limit ?? 500, cursor: page.next_cursor, signal: query.signal };
  }
}

/**
 * 翻译 agent 的编辑部事件（editorial.v1）按条数续读：after 带上次的 next_after，不带从头取。
 * 事件原样返回，解析在 web 的 editorial-room/domain/events.ts（不认识的 type 在那里跳过）。
 */
export async function fetchEditorialEvents(
  jobId: string,
  apiPrefix?: string,
  query: EditorialEventsQuery & { signal?: AbortSignal } = {},
): Promise<EditorialEventListView> {
  const { signal, ...rest } = query;
  const page = await generated.listEditorialEvents(apiPrefix, { job_id: jobId, query: rest }, {
    signal,
    onError: (status, payload) => new JobEventsError(
      payload?.message || `读取编辑部事件失败，请稍后重试。(${status})`,
      status,
      payload?.error?.code || "EDITORIAL_EVENTS_FAILED",
    ),
  });
  if (!page || !Array.isArray(page.events) || !Number.isSafeInteger(page.next_after) || page.next_after < 0
    || typeof page.has_more !== "boolean") {
    throw new JobEventsError("编辑部事件协议不匹配，请更新客户端与后端。", 0, "EVENT_PROTOCOL_MISMATCH");
  }
  return page;
}
