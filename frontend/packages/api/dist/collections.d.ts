export declare function listCollections(apiPrefix: string): Promise<any>;
export declare function createCollection(apiPrefix: string, { name, parentId }?: any): Promise<any>;
export declare function patchCollection(apiPrefix: string, collectionId: string, payload?: Record<string, unknown>): Promise<any>;
export declare function deleteCollection(apiPrefix: string, collectionId: string): Promise<any>;
export declare function addDocumentsToCollection(apiPrefix: string, collectionId: string, documentIds?: string[]): Promise<any>;
export declare function removeDocumentFromCollection(apiPrefix: string, collectionId: string, documentId: string): Promise<any>;
