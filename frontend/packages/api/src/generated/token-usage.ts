// 生成文件，不要手改。来源：contracts/token-usage.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  DocumentUsageEstimateQuery,
  LibraryUsageEstimateQuery,
  PriceLookupInput,
  PriceLookupView,
  UsageEstimateView,
  UsageSummaryView,
} from "@retainpdf/contracts/token-usage";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/usage */
export function getUsageSummary(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<UsageSummaryView> {
  return request<UsageSummaryView>({ apiPrefix, method: "GET", path: `usage`, options });
}

/** GET /api/v1/documents/:document_id/usage */
export function getDocumentUsage(
  apiPrefix: string | undefined,
  args: { document_id: string },
  options?: RequestOptions,
): Promise<UsageSummaryView> {
  return request<UsageSummaryView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/usage`, options });
}

/** GET /api/v1/jobs/:job_id/reports/usage */
export function getJobUsage(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<UsageSummaryView> {
  return request<UsageSummaryView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reports/usage`, options });
}

/** POST /api/v1/usage/prices */
export function lookupModelPrices(
  apiPrefix: string | undefined,
  args: { body: PriceLookupInput },
  options?: RequestOptions,
): Promise<PriceLookupView> {
  return request<PriceLookupView>({ apiPrefix, method: "POST", path: `usage/prices`, body: args.body, options });
}

/** GET /api/v1/documents/:document_id/usage/estimate */
export function estimateDocumentUsage(
  apiPrefix: string | undefined,
  args: { document_id: string; query?: DocumentUsageEstimateQuery },
  options?: RequestOptions,
): Promise<UsageEstimateView> {
  return request<UsageEstimateView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/usage/estimate`, query: args.query, options });
}

/** GET /api/v1/usage/estimate */
export function estimateLibraryUsage(
  apiPrefix: string | undefined,
  args: { query?: LibraryUsageEstimateQuery } = {},
  options?: RequestOptions,
): Promise<UsageEstimateView> {
  return request<UsageEstimateView>({ apiPrefix, method: "GET", path: `usage/estimate`, query: args.query, options });
}
