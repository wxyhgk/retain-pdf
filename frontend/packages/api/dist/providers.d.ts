import type { TranslationModelListView } from "@retainpdf/contracts/translation-providers";
import { type RequestOptions } from "./request.js";
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
/** 服务商错误码目录里的一条，给失败卡片显示「这家服务商说的是什么、该怎么办」。 */
export type ProviderErrorHint = {
    /** 厂商编号（paddle、glm_ocr、openai……）和显示名。 */
    vendor: string;
    vendorLabel: string;
    /** 厂商的业务码；只按状态码对上的是空串。 */
    code: string;
    /** 官方说法（中文）和给用户的提示。 */
    meaning: string;
    hint: string;
    sourceUrl: string;
};
/**
 * 查一条服务商错误码的提示（GET /providers/error-codes，契约 provider-error-codes.v1）。
 * vendor 是目录里的厂商编号；有业务码按码精确查，只有 HTTP 状态码时只认唯一的一条——同一个 429
 * 可能是限流也可能是欠费，猜错比不说更糟。查不到返回 null。
 */
export declare function fetchProviderErrorHint(apiPrefix: string | undefined, target: {
    vendor?: string;
    code?: string;
    httpStatus?: number | null;
}, options?: RequestOptions): Promise<ProviderErrorHint | null>;
