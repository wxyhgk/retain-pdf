export declare function fetchGlossaries(apiPrefix: string): Promise<any>;
export declare function fetchGlossary(glossaryId: string, apiPrefix?: string): Promise<any>;
export declare function createGlossary(apiPrefix: string, payload: unknown): Promise<any>;
export declare function updateGlossary(apiPrefix: string, glossaryId: string, payload: unknown): Promise<any>;
export declare function deleteGlossary(apiPrefix: string, glossaryId: string): Promise<any>;
export declare function exportGlossaryCsv(apiPrefix: string, glossaryId: string): Promise<Response>;
export declare function parseGlossaryCsv(apiPrefix: string, csvText: string): Promise<any>;
