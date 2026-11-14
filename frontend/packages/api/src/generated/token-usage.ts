// 生成文件，不要手改。来源：contracts/token-usage.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
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
