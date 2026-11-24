export type ReaderDocTheme = "light" | "dark";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export declare const READER_DOC_THEME_STORAGE_KEY = "retainpdf:reader:doc-theme:v1";
/** 写在 <html> 上的属性：`data-reader-doc="dark"` 时 doc-theme.css 生效。 */
export declare const READER_DOC_THEME_ATTR = "data-reader-doc";
export declare function loadReaderDocTheme(storage?: StorageLike | null): ReaderDocTheme;
export declare function saveReaderDocTheme(theme: ReaderDocTheme, storage?: StorageLike | null): void;
export declare function applyReaderDocTheme(theme: ReaderDocTheme, root?: HTMLElement | null): void;
export {};
//# sourceMappingURL=reader-doc-theme.d.ts.map