import type { TranslationModelListView, TranslationModelsRequest } from "@retainpdf/contracts/translation-providers";
import { type RequestOptions } from "../request.js";
/** POST /api/v1/providers/translation/models */
export declare function listTranslationProviderModels(apiPrefix: string | undefined, args: {
    body: TranslationModelsRequest;
}, options?: RequestOptions): Promise<TranslationModelListView>;
