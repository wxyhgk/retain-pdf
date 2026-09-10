/** 与 answer-enhance / runtime 中的引用形状兼容；此处用宽松结构避免循环依赖。 */
export type ThreadBranchCitation = {
    ref?: number | string;
    block_id?: string;
    page_idx?: number;
    page?: number;
    job_id?: string;
    document_id?: string;
    snippet?: string;
    [key: string]: unknown;
};
export type ThreadBranchMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    progress?: string;
    citations?: ThreadBranchCitation[];
    status?: {
        type: string;
        reason?: string;
    };
};
export type ThreadBranchItem = {
    parentId: string | null;
    message: ThreadBranchMessage;
};
export type ThreadBranchSnapshot = {
    version: 1;
    headId: string | null;
    items: ThreadBranchItem[];
    /** 快照归属的会话 id（防串会话印章，审计 P2-10）；旧快照无此字段 */
    conversationId?: string;
};
export type ThreadBranchScope = {
    jobId?: string;
    documentId?: string;
};
export type ThreadBranchScopeInput = string | ThreadBranchScope;
export declare function threadBranchStorageKey(scope: ThreadBranchScopeInput, conversationId?: string): string;
export declare function loadThreadBranchSnapshot(scope: ThreadBranchScopeInput, conversationId?: string): ThreadBranchSnapshot | null;
export declare function saveThreadBranchSnapshot(scope: ThreadBranchScopeInput, snapshot: ThreadBranchSnapshot, conversationId?: string): void;
export declare function clearThreadBranchSnapshot(scope: ThreadBranchScopeInput, conversationId?: string): void;
/** 可见路径：从 head 沿 parent 链回溯（parent 须先于 child 出现在 items 中）。 */
export declare function visiblePathFromSnapshot(snapshot: ThreadBranchSnapshot): ThreadBranchMessage[];
//# sourceMappingURL=thread-branch-store.d.ts.map