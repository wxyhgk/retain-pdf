import type { CommittedDocumentSource, ResolvedJobDocument } from "./types.js";
export type SessionDocuments = {
    resolvedDocumentJob: {
        documentId: string;
        jobId: string;
    };
    setResolvedDocumentJob: React.Dispatch<React.SetStateAction<{
        documentId: string;
        jobId: string;
    }>>;
    missingDocumentJob: {
        documentId: string;
        jobId: string;
    };
    setMissingDocumentJob: React.Dispatch<React.SetStateAction<{
        documentId: string;
        jobId: string;
    }>>;
    documentJobId: string;
    rejectedDocumentJobId: string;
    sessionJobId: string;
    resolvedJobDocument: ResolvedJobDocument;
    setResolvedJobDocument: React.Dispatch<React.SetStateAction<ResolvedJobDocument>>;
    jobDocumentId: string;
    documentId: string;
    sourceOnly: boolean;
    committedDocumentSource: CommittedDocumentSource | null;
    setCommittedDocumentSource: React.Dispatch<React.SetStateAction<CommittedDocumentSource | null>>;
    activeCommittedDocumentSource: CommittedDocumentSource | null;
    sourceViewOnly: boolean;
    refreshCommittedDocument: (input: {
        documentId: string;
        revision: string;
    }) => void;
    /** 窄命令：session-assets 只经此 typed event 改身份，不直接拿一串 setter。 */
    applyIdentityEvent: (event: SessionIdentityEvent) => void;
};
/**
 * 跨模块身份变更的 discriminated event。
 * 由 useSessionDocuments 内部翻译成具体 setState，调用方无需知道 state 切分。
 */
export type SessionIdentityEvent = 
/** document 链路解析出 active job：对外暴露该 job 身份。 */
{
    type: "resolved-document-job";
    documentId: string;
    jobId: string;
}
/** stale active job 404：清空该 document 的 job 解析。 */
 | {
    type: "cleared-resolved-document-job";
}
/** stale active job 404：记住该 link 已失效，本 session 不再跟随。 */
 | {
    type: "missing-document-job";
    documentId: string;
    jobId: string;
}
/** job 链路回填 document 身份（保持引用稳定：相同时不重建对象）。 */
 | {
    type: "resolved-job-document";
    jobId: string;
    documentId: string;
}
/** 提交/恢复为文档当前源版本（source 视图）。 */
 | {
    type: "committed-source";
    documentId: string;
    revision: string;
    sessionIdentity: string;
};
export declare function useSessionDocuments(options: {
    routeDocumentId: string;
    jobId: string;
    sessionIdentity: string;
    sessionIdentityRef: React.MutableRefObject<string>;
    documentIdRef: React.MutableRefObject<string>;
    sessionJobIdRef: React.MutableRefObject<string>;
    /** 提交新文档版本时强制切到 source 视图（由 reader-mode 侧提供，内部仅用稳定 setter）。 */
    switchToSourceMode: () => void;
}): SessionDocuments;
//# sourceMappingURL=job-identity.d.ts.map