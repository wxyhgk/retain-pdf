import type { GlossaryCsvParseInput, GlossaryCsvParseView, GlossaryDetailView, GlossaryListView, GlossaryUpsertInput, ListGlossariesQuery } from "@retainpdf/contracts/glossaries";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/glossaries */
export declare function listGlossaries(apiPrefix: string | undefined, args?: {
    query?: ListGlossariesQuery;
}, options?: RequestOptions): Promise<GlossaryListView>;
/** POST /api/v1/glossaries */
export declare function createGlossary(apiPrefix: string | undefined, args: {
    body: GlossaryUpsertInput;
}, options?: RequestOptions): Promise<GlossaryDetailView>;
/** GET /api/v1/glossaries/:glossary_id */
export declare function getGlossary(apiPrefix: string | undefined, args: {
    glossary_id: string;
}, options?: RequestOptions): Promise<GlossaryDetailView>;
/** PUT /api/v1/glossaries/:glossary_id */
export declare function updateGlossary(apiPrefix: string | undefined, args: {
    glossary_id: string;
    body: GlossaryUpsertInput;
}, options?: RequestOptions): Promise<GlossaryDetailView>;
/** DELETE /api/v1/glossaries/:glossary_id */
export declare function deleteGlossary(apiPrefix: string | undefined, args: {
    glossary_id: string;
}, options?: RequestOptions): Promise<GlossaryDetailView>;
/** POST /api/v1/glossaries/parse-csv */
export declare function parseGlossaryCsv(apiPrefix: string | undefined, args: {
    body: GlossaryCsvParseInput;
}, options?: RequestOptions): Promise<GlossaryCsvParseView>;
