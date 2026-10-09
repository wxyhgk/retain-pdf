import { getMockJobEvents } from "@/platform/mock/index.js";
import type { MockJobEvent } from "@/platform/mock/events.js";
import { JobEventsError, type JobEventsQuery } from "@retainpdf/api/jobs-events";
import type { JobEventListView, JobEventRecord } from "@retainpdf/contracts/job-events";

// mock-only 适配器:index.ts 的 mockable() 只在 mock 模式调用本实现。
export async function fetchJobEvents(jobId: string, apiPrefix?: string, query: JobEventsQuery = {}): Promise<JobEventListView> {
  void apiPrefix;
  if (typeof query !== "object" || "offset" in query || (query.cursor && query.start)) {
    throw new JobEventsError("Invalid event query", 400, "INVALID_QUERY");
  }
  const items = getMockJobEvents(jobId).items.map((item: MockJobEvent, index: number) => ({
    ...item, seq: index + 1, event_id: `mock:${jobId}:${index + 1}`,
  }));
  // Mock producers expose snapshots, not an append log. A changed snapshot is
  // an explicit epoch reset so the client never silently skips updated progress.
  const signature = JSON.stringify(items.map(({ ts, created_at, ...item }) => item));
  const limit = Math.max(1, Math.min(500, query.limit ?? 500));
  let position = query.start === "head" ? 0 : Math.max(0, items.length - limit);
  let upper = items.length;
  if (query.cursor) {
    let cursor;
    try { cursor = JSON.parse(decodeURIComponent(atob(query.cursor))); }
    catch { throw new JobEventsError("Invalid cursor", 400, "INVALID_QUERY"); }
    if (cursor.jobId !== jobId || cursor.version !== 2
      || !Number.isSafeInteger(cursor.position) || cursor.position < 0
      || !Number.isSafeInteger(cursor.upper) || cursor.upper < cursor.position) {
      throw new JobEventsError("Invalid cursor scope", 400, "INVALID_QUERY");
    }
    if (cursor.signature !== signature) throw new JobEventsError("Expired cursor", 410, "EVENT_CURSOR_EXPIRED");
    position = cursor.position;
    upper = cursor.position < cursor.upper ? cursor.upper : items.length;
  }
  const batch = items.slice(position, Math.min(upper, position + limit));
  position += batch.length;
  return {
    // mock 快照缺 job_id 等字段，这里保持原行为只做类型断言。
    protocol_version: 2 as const, items: batch as JobEventRecord[], limit, has_more: position < upper,
    next_cursor: btoa(encodeURIComponent(JSON.stringify({ version: 2, jobId, signature, position, upper }))),
  };
}
