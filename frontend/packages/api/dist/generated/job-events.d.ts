import type { EditorialEventListView, EditorialEventsQuery, JobEventListView, ListJobEventsQuery } from "@retainpdf/contracts/job-events";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/jobs/:job_id/progress/events */
export declare function listJobEvents(apiPrefix: string | undefined, args: {
    job_id: string;
    query?: ListJobEventsQuery;
}, options?: RequestOptions): Promise<JobEventListView>;
/** GET /api/v1/jobs/:job_id/progress/editorial */
export declare function listEditorialEvents(apiPrefix: string | undefined, args: {
    job_id: string;
    query?: EditorialEventsQuery;
}, options?: RequestOptions): Promise<EditorialEventListView>;
