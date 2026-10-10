// Cursor feed v2. Translation live-events SSE keeps its separate protocol.
import { apiFetch } from "./internal/runtime.js";
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint } from "./http.js";
export class JobEventsError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "JobEventsError";
    }
}
export function validateJobEventsPage(payload) {
    const page = payload;
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
export function mergeJobEventPages(previous, next) {
    const byId = new Map();
    for (const item of [...(previous?.items || []), ...next.items]) {
        if (!item?.event_id)
            throw new JobEventsError("Event v2 records require event_id", 0, "EVENT_PROTOCOL_MISMATCH");
        byId.set(item.event_id, item);
    }
    const items = Array.from(byId.values()).sort((left, right) => {
        const leftTime = Date.parse(left.created_at || left.ts);
        const rightTime = Date.parse(right.created_at || right.ts);
        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime)
            return leftTime - rightTime;
        return left.seq - right.seq;
    });
    return { ...next, items };
}
export async function fetchJobEvents(jobId, apiPrefix, query = {}) {
    if (typeof query !== "object" || query === null || "offset" in query
        || (query.cursor !== undefined && query.start !== undefined)) {
        throw new JobEventsError("事件流使用 start 或 cursor，不支持 offset。", 400, "INVALID_QUERY");
    }
    const params = new URLSearchParams({ limit: `${query.limit ?? 500}` });
    if (query.cursor !== undefined)
        params.set("cursor", query.cursor);
    else
        params.set("start", query.start ?? "tail");
    const endpoint = `${buildJobDetailEndpoint(jobId, apiPrefix)}/events?${params}`;
    // OCR 任务也走 /jobs/:id/events（后端已统一），不再 404 后退到 /ocr/jobs/ 别名。
    const response = await apiFetch(endpoint, { headers: buildApiHeaders(), signal: query.signal });
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new JobEventsError(error?.message || `读取事件流失败，请稍后重试。(${response.status})`, response.status, error?.error?.code || "EVENT_REQUEST_FAILED");
    }
    return validateJobEventsPage(unwrapEnvelope(await response.json()));
}
/** Drain only the fixed batch encoded by a cursor; never chase a moving head. */
export async function fetchJobEventPages({ fetchPage = fetchJobEvents, jobId, apiPrefix, query = { start: "head" }, isCurrent = () => true, }) {
    const items = [];
    let nextQuery = query;
    while (true) {
        if (!isCurrent() || query.signal?.aborted)
            throw new DOMException("Event load canceled", "AbortError");
        const page = validateJobEventsPage(await fetchPage(jobId, apiPrefix, nextQuery));
        if (!isCurrent() || query.signal?.aborted)
            throw new DOMException("Event load canceled", "AbortError");
        items.push(...page.items);
        if (!page.has_more)
            return mergeJobEventPages(null, { ...page, items });
        if (page.next_cursor === nextQuery.cursor) {
            throw new JobEventsError("事件游标没有前进。", 0, "EVENT_PROTOCOL_MISMATCH");
        }
        nextQuery = { limit: query.limit ?? 500, cursor: page.next_cursor, signal: query.signal };
    }
}
