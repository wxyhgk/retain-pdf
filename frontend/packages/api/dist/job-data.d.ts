import type { JobDatasetQuery, JobDataView } from "@retainpdf/contracts/job-data";
export type { JobDataCatalogView, JobDataView } from "@retainpdf/contracts/job-data";
export type JobDataFilterValue = string | number | boolean | ReadonlyArray<string | number>;
export type JobDataQuery = {
    /** 只要这些字段。 */
    fields?: readonly string[];
    /** 按字段筛（只能用 filter=true 的字段）；数组表示「或」。 */
    filters?: Record<string, JobDataFilterValue | null | undefined>;
    /** 按字段分组，返回 groups: [{value, count}]。 */
    groupBy?: string;
    /** "字段" 升序，"-字段" 降序。 */
    sort?: string;
    offset?: number;
    /** ≤1000，默认 200。 */
    limit?: number;
};
/** 换成接口的查询参数：数组用逗号连接，空值不发，offset、limit 为 0 时不发。 */
export declare function jobDatasetQuery(query?: JobDataQuery): JobDatasetQuery;
export declare function jobDataSearchParams(query?: JobDataQuery): URLSearchParams;
/** 读一个数据集。文件不存在时 available=false，不报错；数据集或字段不对时抛出后端的说明。 */
export declare function fetchJobData(jobId: string, apiPrefix: string | undefined, dataset: string, query?: JobDataQuery): Promise<JobDataView>;
