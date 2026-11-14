import type { UsageSummaryView } from "@retainpdf/contracts/token-usage";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/usage */
export declare function getUsageSummary(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<UsageSummaryView>;
/** GET /api/v1/documents/:document_id/usage */
export declare function getDocumentUsage(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<UsageSummaryView>;
