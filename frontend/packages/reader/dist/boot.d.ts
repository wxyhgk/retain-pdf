import { type Root, type RootOptions } from "react-dom/client";
export type ReaderBootOptions = {
    body?: HTMLElement;
    root?: HTMLElement;
    purgeLegacyMarkup?: boolean;
    /** 传给 createRoot 的选项；宿主用它接出错回调（桌面端把组件栈写进日志）。 */
    rootOptions?: RootOptions;
};
export declare function syncReaderBodyClasses(body?: HTMLElement): void;
/**
 * Removes any sibling markup that predates the Reader mount. Retained
 * intentionally as a defensive cleanup: a stale cached MPA shell (old HTML)
 * can still contain legacy markup, and this is the only guarantee that the
 * React root owns <body>. `bootReader` calls it unless the host explicitly
 * opts out via `purgeLegacyMarkup: false`.
 */
export declare function purgeLegacyMarkup(body?: HTMLElement, preservedRoot?: HTMLElement): void;
export declare function resolveReaderRoot(body?: HTMLElement): HTMLElement;
export declare function bootReader(options?: ReaderBootOptions): Root;
//# sourceMappingURL=boot.d.ts.map