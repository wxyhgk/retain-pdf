// 生成文件，不要手改。来源：contracts/ask-threads.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  AskThreadDeleteResultView,
  AskThreadListView,
  AskThreadView,
  CreateAskThreadInput,
  PatchAskThreadInput,
} from "@retainpdf/contracts/ask-threads";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/documents/:document_id/ask-threads */
export function listAskThreads(
  apiPrefix: string | undefined,
  args: { document_id: string },
  options?: RequestOptions,
): Promise<AskThreadListView> {
  return request<AskThreadListView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/ask-threads`, options });
}

/** POST /api/v1/documents/:document_id/ask-threads */
export function createAskThread(
  apiPrefix: string | undefined,
  args: { document_id: string; body: CreateAskThreadInput },
  options?: RequestOptions,
): Promise<AskThreadView> {
  return request<AskThreadView>({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/ask-threads`, body: args.body, options });
}

/** GET /api/v1/documents/:document_id/ask-threads/:thread_id */
export function getAskThread(
  apiPrefix: string | undefined,
  args: { document_id: string; thread_id: string },
  options?: RequestOptions,
): Promise<AskThreadView> {
  return request<AskThreadView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/ask-threads/${encodePathParam(args.thread_id)}`, options });
}

/** PATCH /api/v1/documents/:document_id/ask-threads/:thread_id */
export function updateAskThread(
  apiPrefix: string | undefined,
  args: { document_id: string; thread_id: string; body: PatchAskThreadInput },
  options?: RequestOptions,
): Promise<AskThreadView> {
  return request<AskThreadView>({ apiPrefix, method: "PATCH", path: `documents/${encodePathParam(args.document_id)}/ask-threads/${encodePathParam(args.thread_id)}`, body: args.body, options });
}

/** DELETE /api/v1/documents/:document_id/ask-threads/:thread_id */
export function deleteAskThread(
  apiPrefix: string | undefined,
  args: { document_id: string; thread_id: string },
  options?: RequestOptions,
): Promise<AskThreadDeleteResultView> {
  return request<AskThreadDeleteResultView>({ apiPrefix, method: "DELETE", path: `documents/${encodePathParam(args.document_id)}/ask-threads/${encodePathParam(args.thread_id)}`, options });
}
