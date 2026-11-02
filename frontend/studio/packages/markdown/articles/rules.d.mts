export declare const SLUG_PATTERN: RegExp;
export declare const ARTICLE_FOLDERS: readonly ['img', 'assets', 'ai'];
export declare const PUBLISHED_FOLDERS: readonly string[];
export declare const LOCAL_ONLY_EXTENSIONS: readonly string[];
export declare function isLocalOnly(path: string): boolean;
export declare const ARTICLE_ADDRESS: RegExp;
export declare function articleAddress(kind: string | undefined, slug: string): string;
