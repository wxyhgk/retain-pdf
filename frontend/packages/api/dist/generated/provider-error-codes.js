// 生成文件，不要手改。来源：contracts/provider-error-codes.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { request } from "../request.js";
/** GET /api/v1/providers/error-codes */
export function listProviderErrorCodes(apiPrefix, args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `providers/error-codes`, query: args.query, options });
}
