// 生成文件，不要手改。来源：contracts/credentials.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/credentials */
export function listCredentials(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `credentials`, options });
}
/** POST /api/v1/credentials */
export function createCredential(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `credentials`, body: args.body, options });
}
/** GET /api/v1/credentials/:credential_ref */
export function getCredential(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `credentials/${encodePathParam(args.credential_ref)}`, options });
}
/** PUT /api/v1/credentials/:credential_ref */
export function updateCredential(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PUT", path: `credentials/${encodePathParam(args.credential_ref)}`, body: args.body, options });
}
/** DELETE /api/v1/credentials/:credential_ref */
export function deleteCredential(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `credentials/${encodePathParam(args.credential_ref)}`, query: args.query, options });
}
