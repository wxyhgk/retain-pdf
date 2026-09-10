type CredentialsPort = {
    getCredentials?: () => {
        modelApiKey?: string;
    } | null;
};
export declare function setReaderAiConfigAdapters(adapters?: {
    credentialsPort?: CredentialsPort | null;
    loadBrowserStoredConfig?: () => any;
    loadDeveloperStoredConfig?: () => any;
    defaultModelBaseUrl?: () => string;
    defaultModelName?: () => string;
}): void;
export declare function resetReaderAiConfigAdapters(): void;
/** 取第一个 trim 后非空的字符串；空白 / 空串不算有效凭据。 */
/**
 * 读取「设置 → API 设置」里的模型 API Key。
 * 优先级：内存 credentials 状态 → 持久化配置（桌面 snapshot / localStorage）。
 * 不读 runtime-config 密钥。
 */
export declare function readSettingsModelApiKey(browserConfig?: any): string;
export declare function resolveReaderAiConfig({ browserConfig, developerConfig, }?: {
    browserConfig?: any;
    developerConfig?: any;
}): {
    apiKey: string;
    baseUrl: string;
    model: string;
    provider: string;
};
/** 是否已在设置中配置下游模型 API Key（对话前置门禁）。 */
export declare function hasModelApiKey(browserConfig?: any): boolean;
/** 凭据保存后派发，供 AI 输入门禁立刻刷新。 */
export declare const CREDENTIALS_CHANGED_EVENT = "retainpdf:credentials-changed";
export declare function notifyCredentialsChanged(): void;
export declare const MISSING_MODEL_API_KEY_MESSAGE = "\u7F3A\u5C11\u6A21\u578B API Key\uFF1A\u8BF7\u5230\u8BBE\u7F6E \u2192 API \u8BBE\u7F6E\u586B\u5199 DeepSeek \u7B49\u6A21\u578B Key\uFF08\u4E0D\u662F\u540E\u7AEF X-API-Key\uFF09\u3002";
export {};
//# sourceMappingURL=config.d.ts.map