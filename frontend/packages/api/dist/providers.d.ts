export declare function validateMineruToken(apiPrefix: string, payload: {
    mineru_token: string;
}): Promise<any>;
export declare function validatePaddleToken(apiPrefix: string, payload: unknown): Promise<any>;
export declare function validateDeepSeekToken(apiPrefix: string, payload: unknown): Promise<any>;
export declare function queryDeepSeekBalance(apiPrefix: string, payload: unknown): Promise<any>;
/** 拉回来的一个模型。price 和 /usage/prices 同形状：每百万 token 的美元单价，查不到是 null。 */
export type ProviderModelPrice = {
    input: number | null;
    output: number | null;
    cache_read?: number | null;
    cache_write?: number | null;
    peak_multiplier?: number | null;
};
export type ProviderModelView = {
    id: string;
    display_name?: string | null;
    owned_by?: string | null;
    created?: number | null;
    /** chat：对话模型；other：名字看得出是 embedding、tts、图片这类，默认不列。 */
    kind: "chat" | "other";
    price_provider?: string | null;
    price_basis?: string | null;
    price?: ProviderModelPrice | null;
};
export type ProviderModelListView = {
    ok: boolean;
    /** ok / unsupported / unauthorized / invalid_input / unreachable / provider_error */
    status: string;
    summary?: string;
    base_url?: string;
    fetched_at?: string;
    provider_code?: string | number | null;
    provider_message?: string | null;
    chat_models?: number;
    models: ProviderModelView[];
};
/**
 * 从翻译接口拉模型列表（POST /providers/translation/models，后端代调服务商的 /models，key 用完不存）。
 * 服务商那边出错也是 200，看 status；没 key、地址不合规是 400。
 */
export declare function fetchTranslationProviderModels(apiPrefix: string, payload: {
    base_url: string;
    api_key: string;
    api_protocol?: string;
}): Promise<ProviderModelListView>;
