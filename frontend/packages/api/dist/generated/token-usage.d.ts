import type { DocumentUsageEstimateQuery, LibraryUsageEstimateQuery, PriceLookupInput, PriceLookupView, UsageEstimateView, UsageSummaryView } from "@retainpdf/contracts/token-usage";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/usage */
export declare function getUsageSummary(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<UsageSummaryView>;
/** GET /api/v1/documents/:document_id/usage */
export declare function getDocumentUsage(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<UsageSummaryView>;
/** POST /api/v1/usage/prices */
export declare function lookupModelPrices(apiPrefix: string | undefined, args: {
    body: PriceLookupInput;
}, options?: RequestOptions): Promise<PriceLookupView>;
/** GET /api/v1/documents/:document_id/usage/estimate */
export declare function estimateDocumentUsage(apiPrefix: string | undefined, args: {
    document_id: string;
    query?: DocumentUsageEstimateQuery;
}, options?: RequestOptions): Promise<UsageEstimateView>;
/** GET /api/v1/usage/estimate */
export declare function estimateLibraryUsage(apiPrefix: string | undefined, args?: {
    query?: LibraryUsageEstimateQuery;
}, options?: RequestOptions): Promise<UsageEstimateView>;
