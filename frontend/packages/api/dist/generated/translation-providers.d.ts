import type { TranslationModelAskRequest, TranslationModelAskView, TranslationModelListView, TranslationModelsRequest } from "@retainpdf/contracts/translation-providers";
import { type RequestOptions } from "../request.js";
/** POST /api/v1/providers/translation/models */
export declare function listTranslationProviderModels(apiPrefix: string | undefined, args: {
    body: TranslationModelsRequest;
}, options?: RequestOptions): Promise<TranslationModelListView>;
/** POST /api/v1/providers/translation/ask */
export declare function askTranslationProviderModel(apiPrefix: string | undefined, args: {
    body: TranslationModelAskRequest;
}, options?: RequestOptions): Promise<TranslationModelAskView>;
