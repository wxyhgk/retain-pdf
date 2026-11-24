// 生成文件，不要手改。来源：contracts/auth-session.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { request } from "../request.js";
/** GET /api/v1/auth/session */
export function getAuthSession(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `auth/session`, options });
}
