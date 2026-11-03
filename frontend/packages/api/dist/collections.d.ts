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
