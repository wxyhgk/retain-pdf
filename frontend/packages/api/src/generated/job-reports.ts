// 生成文件，不要手改。来源：contracts/job-reports.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  JobDiagnosticsView,
  QualitySummaryView,
  TranslationDiagnosticsView,
} from "@retainpdf/contracts/job-reports";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/jobs/:job_id/reports/failure */
export function getFailureReport(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<JobDiagnosticsView> {
  return request<JobDiagnosticsView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/failure`, options });
}

/** GET /api/v1/jobs/:job_id/reports/quality */
export function getQualityReport(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<QualitySummaryView> {
  return request<QualitySummaryView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/quality`, options });
}

/** GET /api/v1/jobs/:job_id/reports/translation */
export function getTranslationReport(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<TranslationDiagnosticsView> {
  return request<TranslationDiagnosticsView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/translation`, options });
}
