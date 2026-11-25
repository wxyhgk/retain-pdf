// 生成文件，不要手改。来源：contracts/ask-threads.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/documents/:document_id/ask-threads */
export function listAskThreads(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/ask-threads`, options });
}
/** POST /api/v1/documents/:document_id/ask-threads */
export function createAskThread(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/ask-threads`, body: args.body, options });
}
/** GET /api/v1/documents/:document_id/ask-threads/:thread_id */
export function getAskThread(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/ask-threads/${encodePathParam(args.thread_id)}`, options });
}
/** PATCH /api/v1/documents/:document_id/ask-threads/:thread_id */
export function updateAskThread(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `documents/${encodePathParam(args.document_id)}/ask-threads/${encodePathParam(args.thread_id)}`, body: args.body, options });
}
/** DELETE /api/v1/documents/:document_id/ask-threads/:thread_id */
export function deleteAskThread(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `documents/${encodePathParam(args.document_id)}/ask-threads/${encodePathParam(args.thread_id)}`, options });
}
