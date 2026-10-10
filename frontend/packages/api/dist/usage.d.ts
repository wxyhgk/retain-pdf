import type { UsageSummaryView } from "@retainpdf/contracts/token-usage";
export type { UsageSummaryView } from "@retainpdf/contracts/token-usage";
/** 一本书的全部任务，加上问这本书时助手花的。 */
export declare function fetchDocumentUsage(documentId: string, apiPrefix?: string): Promise<UsageSummaryView>;
/** 全部用量（删除的书不计入）。 */
export declare function fetchUsageSummary(apiPrefix?: string): Promise<UsageSummaryView>;
/** 单个任务；任务不存在时后端返回 404。 */
export declare function fetchJobUsage(jobId: string, apiPrefix?: string): Promise<UsageSummaryView>;
