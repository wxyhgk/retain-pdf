// 生成文件，不要手改。来源：contracts/job-reports.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/jobs/:job_id/reports/failure */
export function getFailureReport(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/failure`, options });
}
/** GET /api/v1/jobs/:job_id/reports/quality */
export function getQualityReport(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/quality`, options });
}
/** GET /api/v1/jobs/:job_id/reports/translation */
export function getTranslationReport(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/translation`, options });
}
