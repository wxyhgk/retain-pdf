// 生成文件，不要手改。来源：contracts/reader-data.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/jobs/:job_id/files */
export function listJobFiles(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/files`, options });
}
/** GET /api/v1/jobs/:job_id/reader/markdown */
export function getReaderMarkdown(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reader/markdown`, options });
}
/** GET /api/v1/jobs/:job_id/reader/regions */
export function getReaderRegions(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reader/regions`, options });
}
/** GET /api/v1/jobs/:job_id/reader/metadata */
export function getReaderMetadata(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reader/metadata`, options });
}
/** GET /api/v1/jobs/:job_id/progress/layout */
export function getLiveLayout(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/progress/layout`, options });
}
/** GET /api/v1/jobs/:job_id/progress/pages/:page */
export function getLivePage(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/progress/pages/${encodePathParam(args.page)}`, options });
}
