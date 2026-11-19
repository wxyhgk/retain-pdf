import * as generated from "./generated/token-usage.js";
import { serverMessageOr } from "./request.js";
function usageError(label) {
    return { onError: serverMessageOr(`读取${label}用量失败，请稍后重试。`) };
}
/** 一本书的全部任务，加上问这本书时助手花的。 */
export function fetchDocumentUsage(documentId, apiPrefix) {
    return generated.getDocumentUsage(apiPrefix, { document_id: documentId }, usageError("这本书的"));
}
/** 全部用量（删除的书不计入）。 */
export function fetchUsageSummary(apiPrefix) {
    return generated.getUsageSummary(apiPrefix, {}, usageError(""));
}
/**
 * 重新翻译这本书换成某个模型大概要花多少：按这本书最近一次翻译的用量（没翻译过按书库每页平均）乘这个模型的单价。
 * 下限按上次的缓存命中算，上限当缓存全没命中（DeepSeek 再按忙时）。查不到价时金额是 null。
 */
export function estimateDocumentUsage(documentId, { baseUrl, model }, apiPrefix) {
    return generated.estimateDocumentUsage(apiPrefix, { document_id: documentId, query: { base_url: baseUrl, model } }, { onError: serverMessageOr("估算花费失败，请稍后重试。") });
}
