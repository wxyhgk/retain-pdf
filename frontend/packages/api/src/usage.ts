// usage — pure：模型 token 用量（契约 token-usage.v1）。请求走生成的函数，这里只管报错文案。
import type { UsageSummaryView } from "@retainpdf/contracts/token-usage";
import * as generated from "./generated/token-usage.js";
import { serverMessageOr } from "./request.js";

export type { UsageSummaryView } from "@retainpdf/contracts/token-usage";

function usageError(label: string) {
  return { onError: serverMessageOr(`读取${label}用量失败，请稍后重试。`) };
}

/** 一本书的全部任务，加上问这本书时助手花的。 */
export function fetchDocumentUsage(documentId: string, apiPrefix?: string): Promise<UsageSummaryView> {
  return generated.getDocumentUsage(apiPrefix, { document_id: documentId }, usageError("这本书的"));
}

/** 全部用量（删除的书不计入）。 */
export function fetchUsageSummary(apiPrefix?: string): Promise<UsageSummaryView> {
  return generated.getUsageSummary(apiPrefix, {}, usageError(""));
}

