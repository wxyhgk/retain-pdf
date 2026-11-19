import type { TranslationModelListView } from "@retainpdf/contracts/translation-providers";
export declare function validateMineruToken(apiPrefix: string, payload: {
    mineru_token: string;
}): Promise<any>;
export declare function validatePaddleToken(apiPrefix: string, payload: unknown): Promise<any>;
export declare function validateDeepSeekToken(apiPrefix: string, payload: unknown): Promise<any>;
export declare function queryDeepSeekBalance(apiPrefix: string, payload: unknown): Promise<any>;
export type { TranslationModelListView as ProviderModelListView, TranslationModelView as ProviderModelView, } from "@retainpdf/contracts/translation-providers";
/**
 * 从翻译接口拉模型列表（POST /providers/translation/models，契约 translation-providers.v1；后端代调服务商的 /models，
 * key 用完不存）。服务商那边出错也是 200，看 status；没 key、地址不合规是 400。和检测一样最多等 30 秒。
 */
export declare function fetchTranslationProviderModels(apiPrefix: string, payload: {
    base_url: string;
    api_key: string;
    api_protocol?: string;
}): Promise<TranslationModelListView>;
