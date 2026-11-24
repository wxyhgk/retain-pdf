// 生成文件，不要手改。来源：contracts/provider-probes.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { request } from "../request.js";
/** POST /api/v1/providers/mineru/validate-token */
export function validateMineruToken(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `providers/mineru/validate-token`, body: args.body, options });
}
/** POST /api/v1/providers/paddle/validate-token */
export function validatePaddleToken(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `providers/paddle/validate-token`, body: args.body, options });
}
/** POST /api/v1/providers/deepseek/validate-token */
export function validateDeepSeekToken(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `providers/deepseek/validate-token`, body: args.body, options });
}
/** POST /api/v1/providers/deepseek/balance */
export function queryDeepSeekBalance(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `providers/deepseek/balance`, body: args.body, options });
}
