import type { JobDataView, JobDatasetQuery } from "@retainpdf/contracts/job-data";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/jobs/:job_id/data/:dataset */
export declare function getJobDataset(apiPrefix: string | undefined, args: {
    job_id: string;
    dataset: string;
    query?: JobDatasetQuery;
}, options?: RequestOptions): Promise<JobDataView>;
