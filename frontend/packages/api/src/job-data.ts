// job-data — pure：通用取数接口（契约 job-data.v1）。任务里已有的数据都从这里按数据集名读，
// 缺哪个数据集请后端在登记表里加一条，不再为每种数据开新接口。
import { apiFetch } from "./internal/runtime.js";
import type { JobDataCatalogView, JobDataView } from "@retainpdf/contracts/job-data";
import { buildApiHeaders, buildJobDetailEndpoint, unwrapEnvelope } from "./http.js";

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

async function getJson<T>(url: string): Promise<T> {
  const resp = await apiFetch(url, { headers: buildApiHeaders() });
  if (!resp.ok) {
    const error = await resp.json().catch(() => null);
    throw new Error(error?.message || `读取任务数据失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json()) as T;
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

/** 这个任务有哪些数据集、各有哪些字段、能不能筛。 */
export function fetchJobDataCatalog(jobId: string, apiPrefix?: string): Promise<JobDataCatalogView> {
  return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/data`);
}

/** 读一个数据集。文件不存在时 available=false，不报错；数据集或字段不对时抛出后端的说明。 */
export function fetchJobData(jobId: string, apiPrefix: string | undefined, dataset: string, query: JobDataQuery = {}): Promise<JobDataView> {
  const params = jobDataSearchParams(query).toString();
  return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/data/${encodeURIComponent(dataset)}${params ? `?${params}` : ""}`);
}
