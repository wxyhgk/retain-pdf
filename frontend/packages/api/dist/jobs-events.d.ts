import type { EditorialEventListView, EditorialEventsQuery, JobEventListView, ListJobEventsQuery } from "@retainpdf/contracts/job-events";
export type JobEventsQuery = ListJobEventsQuery & {
    signal?: AbortSignal;
};
export declare class JobEventsError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(message: string, status: number, code: string);
}
export declare function validateJobEventsPage(payload: unknown): JobEventListView;
export declare function mergeJobEventPages(previous: {
    items?: JobEventListView["items"];
} | null, next: JobEventListView): JobEventListView;
export declare function fetchJobEvents(jobId: string, apiPrefix?: string, query?: JobEventsQuery): Promise<JobEventListView>;
/** Drain only the fixed batch encoded by a cursor; never chase a moving head. */
export declare function fetchJobEventPages({ fetchPage, jobId, apiPrefix, query, isCurrent, }: {
    fetchPage?: typeof fetchJobEvents;
    jobId: string;
    apiPrefix?: string;
    query?: JobEventsQuery;
    isCurrent?: () => boolean;
}): Promise<JobEventListView>;
/**
 * 翻译 agent 的编辑部事件（editorial.v1）按条数续读：after 带上次的 next_after，不带从头取。
 * 事件原样返回，解析在 web 的 editorial-room/domain/events.ts（不认识的 type 在那里跳过）。
 */
export declare function fetchEditorialEvents(jobId: string, apiPrefix?: string, query?: EditorialEventsQuery & {
    signal?: AbortSignal;
}): Promise<EditorialEventListView>;
