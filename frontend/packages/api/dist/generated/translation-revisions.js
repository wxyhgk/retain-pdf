// 生成文件，不要手改。来源：contracts/translation-revisions.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/jobs/:job_id/translations */
export function listTranslationItems(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/translations`, query: args.query, options });
}
/** GET /api/v1/jobs/:job_id/translations/:item_id */
export function getTranslationItem(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/translations/${encodePathParam(args.item_id)}`, options });
}
/** PATCH /api/v1/jobs/:job_id/translations/:item_id */
export function updateTranslationItem(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `jobs/${encodePathParam(args.job_id)}/translations/${encodePathParam(args.item_id)}`, body: args.body, options });
}
/** POST /api/v1/jobs/:job_id/translations/:item_id/replay */
export function replayTranslationItem(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `jobs/${encodePathParam(args.job_id)}/translations/${encodePathParam(args.item_id)}/replay`, options });
}
