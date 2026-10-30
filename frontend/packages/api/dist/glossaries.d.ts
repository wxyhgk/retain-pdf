import type { GlossaryCsvParseView, GlossaryDetailView, GlossaryListView, GlossaryUpsertInput } from "@retainpdf/contracts/glossaries";
export type { GlossaryCsvParseView, GlossaryDetailView, GlossaryListView, GlossaryUpsertInput };
export declare function fetchGlossaries(apiPrefix: string): Promise<GlossaryListView>;
export declare function fetchGlossary(glossaryId: string, apiPrefix?: string): Promise<GlossaryDetailView>;
export declare function createGlossary(apiPrefix: string, payload: unknown): Promise<GlossaryDetailView>;
export declare function updateGlossary(apiPrefix: string, glossaryId: string, payload: unknown): Promise<GlossaryDetailView>;
export declare function deleteGlossary(apiPrefix: string, glossaryId: string): Promise<GlossaryDetailView>;
export declare function exportGlossaryCsv(apiPrefix: string, glossaryId: string): Promise<Response>;
export declare function parseGlossaryCsv(apiPrefix: string, csvText: string): Promise<GlossaryCsvParseView>;
