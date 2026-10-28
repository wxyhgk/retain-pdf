// quality — pure：一个任务的译文质量摘要与问题明细（GET /jobs/:id/reports/quality、/reports/quality/items）。
// 请求走生成的函数（契约 job-reports.v1），下面的类型是界面在用的形状，契约的返回能直接赋给它们。
import * as generated from "./generated/job-reports.js";
import { serverMessageOr } from "./request.js";
export function fetchQualitySummary(jobId, apiPrefix) {
    return generated.getQualityReport(apiPrefix, { job_id: jobId }, { onError: serverMessageOr("读取质量摘要失败，请稍后重试。") });
}
