import { messagesToBranchItems, type AiCitationLike, type ThreadBranchMessage, type ThreadBranchSnapshot } from "../../../external.js";
export type ReaderAskStoreMessage = Omit<ThreadBranchMessage, "citations"> & {
    citations?: AiCitationLike[];
};
export type ReaderAskTreeItem = {
    parentId: string | null;
    message: ReaderAskStoreMessage;
};
export declare function snapshotFromTree(items: readonly ReaderAskTreeItem[], headId: string | null): ThreadBranchSnapshot;
export declare function treeFromSnapshot(snapshot: ThreadBranchSnapshot): {
    items: ReaderAskTreeItem[];
    headId: string | null;
};
export declare function visibleMessages(items: readonly ReaderAskTreeItem[], headId: string | null): ReaderAskStoreMessage[];
export declare function findMessage(items: readonly ReaderAskTreeItem[], id: string | null | undefined): ReaderAskStoreMessage | null;
export declare function pathForBranch(items: readonly ReaderAskTreeItem[], targetId: string, headId: string | null): ReaderAskTreeItem[];
export declare function treeItemsFromBranchItems(branchItems: ReturnType<typeof messagesToBranchItems>): ReaderAskTreeItem[];
//# sourceMappingURL=reader-ask-tree.d.ts.map