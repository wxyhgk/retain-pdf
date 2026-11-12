import * as translations from "./generated/translation-revisions.js";
export declare function fetchTranslationDiagnostics(jobId: string, apiPrefix?: string): Promise<any>;
export declare function fetchTranslationItems(jobId: string, apiPrefix: string | undefined, { limit, offset, page, finalStatus, errorType, route, q }?: {
    limit?: number;
    offset?: number;
    page?: string;
    finalStatus?: string;
    errorType?: string;
    route?: string;
    q?: string;
}): Promise<any>;
export declare function fetchTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any>;
export declare function replayTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any>;
/** 改单条译文时后端的拒绝原因（error.details.reason）。 */
export type TranslationRevisionIssueView = {
    item_id?: string;
    kind?: string;
    severity?: string;
    message?: string;
};
/**
 * 改单条译文（PATCH /jobs/:id/translations/:item_id）。失败时抛的 Error 带 status、reason（后端的 details.reason）
 * 和 issues（校验没过时的每一条问题），界面按它们说人话。
 */
export declare function reviseTranslationItem(jobId: string, itemId: string, body: Parameters<typeof translations.updateTranslationItem>[1]["body"], apiPrefix?: string): Promise<Awaited<ReturnType<typeof translations.updateTranslationItem>>>;
