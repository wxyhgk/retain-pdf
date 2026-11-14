// 生成文件，不要手改。来源：contracts/token-usage.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/usage */
export function getUsageSummary(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `usage`, options });
}
/** GET /api/v1/documents/:document_id/usage */
export function getDocumentUsage(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/usage`, options });
}
