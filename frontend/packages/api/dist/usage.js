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
