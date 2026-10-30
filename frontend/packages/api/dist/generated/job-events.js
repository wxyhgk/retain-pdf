// 生成文件，不要手改。来源：contracts/job-events.v2.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/jobs/:job_id/progress/events */
export function listJobEvents(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/progress/events`, query: args.query, options });
}
/** GET /api/v1/jobs/:job_id/progress/editorial */
export function listEditorialEvents(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/progress/editorial`, query: args.query, options });
}
