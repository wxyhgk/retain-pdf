import type { JobEventListView } from "@retainpdf/contracts/job-status";
export declare function fetchJobEvents(jobId: string, apiPrefix?: string, limit?: number, offset?: number): Promise<JobEventListView>;
