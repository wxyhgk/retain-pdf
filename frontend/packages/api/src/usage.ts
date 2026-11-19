// usage — pure：模型 token 用量（契约 token-usage.v1）。请求走生成的函数，这里只管报错文案。
import type { UsageEstimateView, UsageSummaryView } from "@retainpdf/contracts/token-usage";
import * as generated from "./generated/token-usage.js";
import { serverMessageOr } from "./request.js";

export type { UsageEstimatePart, UsageEstimateView, UsageSummaryView } from "@retainpdf/contracts/token-usage";

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


/**
 * 重新翻译这本书换成某个模型大概要花多少：按这本书最近一次翻译的用量（没翻译过按书库每页平均）乘这个模型的单价。
 * 下限按上次的缓存命中算，上限当缓存全没命中（DeepSeek 再按忙时）。查不到价时金额是 null。
 */
export function estimateDocumentUsage(
  documentId: string,
  { baseUrl, model }: { baseUrl: string; model: string },
  apiPrefix?: string,
): Promise<UsageEstimateView> {
  return generated.estimateDocumentUsage(
    apiPrefix,
    { document_id: documentId, query: { base_url: baseUrl, model } },
    { onError: serverMessageOr("估算花费失败，请稍后重试。") },
  );
}
