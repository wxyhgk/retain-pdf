// job-data — pure：通用取数接口（契约 job-data.v1）。任务里已有的数据都从这里按数据集名读，
// 缺哪个数据集请后端在登记表里加一条，不再为每种数据开新接口。
import type { JobDataCatalogView, JobDatasetQuery, JobDataView } from "@retainpdf/contracts/job-data";
import * as generated from "./generated/job-data.js";
import { serverMessageOr } from "./request.js";

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

const jobDataError = { onError: serverMessageOr("读取任务数据失败，请稍后重试。") };

/** 换成接口的查询参数：数组用逗号连接，空值不发，offset、limit 为 0 时不发。 */
export function jobDatasetQuery(query: JobDataQuery = {}): JobDatasetQuery {
  const result: JobDatasetQuery = {};
  if (query.fields?.length) result.fields = query.fields.join(",");
  for (const [field, value] of Object.entries(query.filters || {})) {
    if (value === null || value === undefined || value === "") continue;
    result[field] = Array.isArray(value) ? value.join(",") : (value as string | number | boolean);
  }
  if (query.groupBy) result.group_by = query.groupBy;
  if (query.sort) result.sort = query.sort;
  if (query.offset) result.offset = query.offset;
  if (query.limit) result.limit = query.limit;
  return result;
}

export function jobDataSearchParams(query: JobDataQuery = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (query.fields?.length) params.set("fields", query.fields.join(","));
  for (const [field, value] of Object.entries(query.filters || {})) {
    if (value === null || value === undefined || value === "") continue;
    params.set(field, Array.isArray(value) ? value.join(",") : `${value}`);
  }
  if (query.groupBy) params.set("group_by", query.groupBy);
  if (query.sort) params.set("sort", query.sort);
  if (query.offset) params.set("offset", `${query.offset}`);
  if (query.limit) params.set("limit", `${query.limit}`);
  return params;
}

/** 读一个数据集。文件不存在时 available=false，不报错；数据集或字段不对时抛出后端的说明。 */
export function fetchJobData(jobId: string, apiPrefix: string | undefined, dataset: string, query: JobDataQuery = {}): Promise<JobDataView> {
  return generated.getJobDataset(apiPrefix, { job_id: jobId, dataset, query: jobDatasetQuery(query) }, jobDataError);
}
