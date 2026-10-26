export declare const SOURCE_LOCALE: 'zh-CN';
export declare function registerLocale(id: string, name: string, messages: Record<string, string>): void;
export declare function availableLocales(): Array<{ id: string; name: string }>;
export declare function setLocale(id: string): void;
export declare function setLocaleResolver(find: (() => string | undefined) | null): void;
export declare function locale(): string;
export declare function matchLocale(wanted: readonly string[]): string;
export declare function t(source: string, params?: Record<string, unknown>): string;
