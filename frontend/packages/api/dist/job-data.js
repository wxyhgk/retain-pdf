// job-data — pure：通用取数接口（契约 job-data.v1）。任务里已有的数据都从这里按数据集名读，
// 缺哪个数据集请后端在登记表里加一条，不再为每种数据开新接口。
import { apiFetch } from "./internal/runtime.js";
import { buildApiHeaders, buildJobDetailEndpoint, unwrapEnvelope } from "./http.js";
async function getJson(url) {
    const resp = await apiFetch(url, { headers: buildApiHeaders() });
    if (!resp.ok) {
        const error = await resp.json().catch(() => null);
        throw new Error(error?.message || `读取任务数据失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export function jobDataSearchParams(query = {}) {
    const params = new URLSearchParams();
    if (query.fields?.length)
        params.set("fields", query.fields.join(","));
    for (const [field, value] of Object.entries(query.filters || {})) {
        if (value === null || value === undefined || value === "")
            continue;
        params.set(field, Array.isArray(value) ? value.join(",") : `${value}`);
    }
    if (query.groupBy)
        params.set("group_by", query.groupBy);
    if (query.sort)
        params.set("sort", query.sort);
    if (query.offset)
        params.set("offset", `${query.offset}`);
    if (query.limit)
        params.set("limit", `${query.limit}`);
    return params;
}
/** 这个任务有哪些数据集、各有哪些字段、能不能筛。 */
export function fetchJobDataCatalog(jobId, apiPrefix) {
    return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/data`);
}
/** 读一个数据集。文件不存在时 available=false，不报错；数据集或字段不对时抛出后端的说明。 */
export function fetchJobData(jobId, apiPrefix, dataset, query = {}) {
    const params = jobDataSearchParams(query).toString();
    return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/data/${encodeURIComponent(dataset)}${params ? `?${params}` : ""}`);
}
