import * as generated from "./generated/job-data.js";
import { serverMessageOr } from "./request.js";
const jobDataError = { onError: serverMessageOr("读取任务数据失败，请稍后重试。") };
/** 换成接口的查询参数：数组用逗号连接，空值不发，offset、limit 为 0 时不发。 */
export function jobDatasetQuery(query = {}) {
    const result = {};
    if (query.fields?.length)
        result.fields = query.fields.join(",");
    for (const [field, value] of Object.entries(query.filters || {})) {
        if (value === null || value === undefined || value === "")
            continue;
        result[field] = Array.isArray(value) ? value.join(",") : value;
    }
    if (query.groupBy)
        result.group_by = query.groupBy;
    if (query.sort)
        result.sort = query.sort;
    if (query.offset)
        result.offset = query.offset;
    if (query.limit)
        result.limit = query.limit;
    return result;
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
/** 读一个数据集。文件不存在时 available=false，不报错；数据集或字段不对时抛出后端的说明。 */
export function fetchJobData(jobId, apiPrefix, dataset, query = {}) {
    return generated.getJobDataset(apiPrefix, { job_id: jobId, dataset, query: jobDatasetQuery(query) }, jobDataError);
}
