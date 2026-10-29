// 生成文件，不要手改。来源：contracts/glossaries.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/glossaries */
export function listGlossaries(apiPrefix, args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `glossaries`, query: args.query, options });
}
/** POST /api/v1/glossaries */
export function createGlossary(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `glossaries`, body: args.body, options });
}
/** GET /api/v1/glossaries/:glossary_id */
export function getGlossary(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `glossaries/${encodePathParam(args.glossary_id)}`, options });
}
/** PUT /api/v1/glossaries/:glossary_id */
export function updateGlossary(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PUT", path: `glossaries/${encodePathParam(args.glossary_id)}`, body: args.body, options });
}
/** DELETE /api/v1/glossaries/:glossary_id */
export function deleteGlossary(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `glossaries/${encodePathParam(args.glossary_id)}`, options });
}
/** POST /api/v1/glossaries/parse-csv */
export function parseGlossaryCsv(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `glossaries/parse-csv`, body: args.body, options });
}
