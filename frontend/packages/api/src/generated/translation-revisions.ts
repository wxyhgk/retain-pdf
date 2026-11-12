// 生成文件，不要手改。来源：contracts/translation-revisions.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  ListTranslationItemsQuery,
  ReviseTranslationItemRequest,
  TranslationDebugItemView,
  TranslationDebugListView,
  TranslationReplayView,
  TranslationRevisionView,
} from "@retainpdf/contracts/translation-revisions";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/jobs/:job_id/translations */
export function listTranslationItems(
  apiPrefix: string | undefined,
  args: { job_id: string; query?: ListTranslationItemsQuery },
  options?: RequestOptions,
): Promise<TranslationDebugListView> {
  return request<TranslationDebugListView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/translations`, query: args.query, options });
}

/** GET /api/v1/jobs/:job_id/translations/:item_id */
export function getTranslationItem(
  apiPrefix: string | undefined,
  args: { job_id: string; item_id: string },
  options?: RequestOptions,
): Promise<TranslationDebugItemView> {
  return request<TranslationDebugItemView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/translations/${encodePathParam(args.item_id)}`, options });
}

/** PATCH /api/v1/jobs/:job_id/translations/:item_id */
export function updateTranslationItem(
  apiPrefix: string | undefined,
  args: { job_id: string; item_id: string; body: ReviseTranslationItemRequest },
  options?: RequestOptions,
): Promise<TranslationRevisionView> {
  return request<TranslationRevisionView>({ apiPrefix, method: "PATCH", path: `jobs/${encodePathParam(args.job_id)}/translations/${encodePathParam(args.item_id)}`, body: args.body, options });
}

/** POST /api/v1/jobs/:job_id/translations/:item_id/replay */
export function replayTranslationItem(
  apiPrefix: string | undefined,
  args: { job_id: string; item_id: string },
  options?: RequestOptions,
): Promise<TranslationReplayView> {
  return request<TranslationReplayView>({ apiPrefix, method: "POST", path: `jobs/${encodePathParam(args.job_id)}/translations/${encodePathParam(args.item_id)}/replay`, options });
}
