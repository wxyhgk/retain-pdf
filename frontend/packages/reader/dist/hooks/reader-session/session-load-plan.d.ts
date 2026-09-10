/** 从文档详情响应中提取关联身份（对应原 docData.active_job_id/active_version_id）。 */
export type DocumentLink = {
    activeJobId: string;
    activeVersionId: string;
};
/** 原内联逻辑：const docData = docJson?.data ?? docJson。 */
export declare function parseDocumentLink(docJson: unknown): DocumentLink;
export type SourceOnlyPlan = 
/** 跟随文档的 active job：对外暴露该 job 身份后走统一 job 分支。 */
{
    kind: "follow-active-job";
    jobId: string;
    activeVersionId: string;
}
/** 仅恢复已提交的文档源版本（source 视图），不下载 job 产物。 */
 | {
    kind: "open-committed-source";
    documentId: string;
    revision: string;
}
/** 直接打开馆藏源 PDF。 */
 | {
    kind: "open-source-url";
};
export declare function planSourceOnlyLoad(input: {
    link: DocumentLink;
    rejectedDocumentJobId: string;
    hasCommittedSource: boolean;
}): SourceOnlyPlan;
export type JobLoadPlan = 
/** 仅当前 active job 恢复其 committed 文档源（source 视图），不下载 job 产物。 */
{
    kind: "restore-committed-source";
    documentId: string;
    revision: string;
}
/** 打开该 job 自己的不可变产物（原文/译文 artifact 或回退源 PDF）。 */
 | {
    kind: "open-job-artifacts";
};
export declare function planJobLoad(input: {
    payloadDocumentId: string;
    linkedActiveJobId: string;
    linkedActiveVersionId: string;
    sessionJobId: string;
    hasCommittedSource: boolean;
}): JobLoadPlan;
/**
 * document 链路 stale active job 的 404 回退判定。
 * 仅当 sessionJobId 确实来自 document 解析（sessionJobId === documentJobId）
 * 且当前 route 是 document 链路（!jobId 有显式 job）时成立。
 */
export declare function isStaleDocumentJobFailure(input: {
    status: number;
    jobId: string;
    routeDocumentId: string;
    documentJobId: string;
    sessionJobId: string;
}): boolean;
//# sourceMappingURL=session-load-plan.d.ts.map