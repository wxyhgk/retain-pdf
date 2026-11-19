import type { ReaderTranslationEditPort } from "../contracts/session.js";
export type BlockEditTarget = {
    itemId: string;
    page: number;
};
export type RerenderState = {
    phase: "idle";
} | {
    phase: "submitting";
}
/** seenActive：已经看到任务进了排队/运行（提交后第一次问状态之前，旧的 succeeded 还在）。 */
 | {
    phase: "running";
    seenActive: boolean;
} | {
    phase: "failed";
    message: string;
};
export type ReaderBlockEdit = {
    /** 宿主给了改译文的能力、这本书有译文：画「改」按钮和面板。 */
    available: boolean;
    /** 现在不能改的原因（拼出来的书、正在处理）；能改是空串。 */
    blockedReason: string;
    port: ReaderTranslationEditPort | null;
    /** 译文在哪个任务上（重新排版出来的任务指回来源任务）；还没问到是空串。 */
    ownerJobId: string;
    /** 正在框里改的那一块；null = 没在改。 */
    target: BlockEditTarget | null;
    select: (itemId: string) => void;
    /** 收起编辑框（取消、存完）。 */
    close: () => void;
    /** 跨块留着的东西：没存的草稿（按块号）、上一次写回的 generation（下次带上防冲突）。编辑框换页会重新挂载，放这里不丢。 */
    memory: BlockEditMemory;
    /** 阅读页块号 → 写回了、还没排进 PDF 的译文。 */
    pendingEdits: ReadonlyMap<string, string>;
    /** 这次打开以后又改过几次（叠到「改过 N 次」的标记上）。 */
    savedCounts: ReadonlyMap<string, number>;
    markSaved: (itemId: string, text: string) => void;
    rerender: RerenderState;
    startRerender: () => Promise<void>;
};
export type BlockEditMemory = {
    drafts: Map<string, string>;
    generation: {
        current: number | null;
    };
};
export declare function useReaderBlockEdit({ jobId, jobStatus, jobPayload, hasTranslation, refreshJobStatus, }: {
    jobId: string;
    jobStatus: string;
    jobPayload: unknown;
    /** 这次打开有译文 PDF（不是原文直开）。 */
    hasTranslation: boolean;
    refreshJobStatus: () => Promise<void>;
}): ReaderBlockEdit;
/** 鼠标停在一块上按 E：改这一块（打字时、按着修饰键时不管）。 */
export declare function useEditBlockShortcut(editBlock: ((itemId: string) => void) | null, regionHover: {
    get: () => {
        itemId: string | null;
    };
}): void;
//# sourceMappingURL=use-reader-block-edit.d.ts.map