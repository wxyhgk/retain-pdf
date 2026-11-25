// 生成文件，不要手改。来源：contracts/job-data.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/jobs/:job_id/data/:dataset */
export function getJobDataset(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/data/${encodePathParam(args.dataset)}`, query: args.query, options });
}
