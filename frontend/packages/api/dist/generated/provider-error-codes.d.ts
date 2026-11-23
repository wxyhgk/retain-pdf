import type { ProviderErrorCatalogueView, ProviderErrorCodesQuery } from "@retainpdf/contracts/provider-error-codes";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/providers/error-codes */
export declare function listProviderErrorCodes(apiPrefix: string | undefined, args?: {
    query?: ProviderErrorCodesQuery;
}, options?: RequestOptions): Promise<ProviderErrorCatalogueView>;
