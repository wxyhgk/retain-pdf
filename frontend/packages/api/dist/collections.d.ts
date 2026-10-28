import type { CollectionDeleteResultView, CollectionDocumentRemoveResultView, CollectionListView, CollectionRecord, PatchCollectionInput } from "@retainpdf/contracts/library-documents";
export type { CollectionListView, CollectionRecord, PatchCollectionInput };
export declare function listCollections(apiPrefix: string): Promise<CollectionListView>;
export declare function createCollection(apiPrefix: string, { name, parentId }?: {
    name?: string;
    parentId?: string;
}): Promise<CollectionRecord>;
export declare function patchCollection(apiPrefix: string, collectionId: string, payload?: PatchCollectionInput): Promise<CollectionRecord>;
export declare function deleteCollection(apiPrefix: string, collectionId: string): Promise<CollectionDeleteResultView>;
export declare function addDocumentsToCollection(apiPrefix: string, collectionId: string, documentIds?: string[]): Promise<CollectionRecord>;
export declare function removeDocumentFromCollection(apiPrefix: string, collectionId: string, documentId: string): Promise<CollectionDocumentRemoveResultView>;
/** 物化一个文件夹的 agent 工作区（终端切到「文件夹」作用域之前调）。返回 {books: [...]}。
 * 属于 AI 那批，契约里还没有这条，先借生成层的 request() 发，不另手写请求。 */
export declare function materializeCollectionWorkspace(apiPrefix: string, collectionId: string): Promise<{
    books?: unknown[];
} | null>;
