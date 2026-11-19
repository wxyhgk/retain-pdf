import type { UsageEstimateView, UsageSummaryView } from "@retainpdf/contracts/token-usage";
export type { UsageEstimatePart, UsageEstimateView, UsageSummaryView } from "@retainpdf/contracts/token-usage";
/** 一本书的全部任务，加上问这本书时助手花的。 */
export declare function fetchDocumentUsage(documentId: string, apiPrefix?: string): Promise<UsageSummaryView>;
/** 全部用量（删除的书不计入）。 */
export declare function fetchUsageSummary(apiPrefix?: string): Promise<UsageSummaryView>;
/**
 * 重新翻译这本书换成某个模型大概要花多少：按这本书最近一次翻译的用量（没翻译过按书库每页平均）乘这个模型的单价。
 * 下限按上次的缓存命中算，上限当缓存全没命中（DeepSeek 再按忙时）。查不到价时金额是 null。
 */
export declare function estimateDocumentUsage(documentId: string, { baseUrl, model }: {
    baseUrl: string;
    model: string;
}, apiPrefix?: string): Promise<UsageEstimateView>;
