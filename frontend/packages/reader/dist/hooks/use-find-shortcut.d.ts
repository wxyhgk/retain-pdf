/** 书内搜索框的类名（ReaderFinder 的 Input）。 */
export declare const READER_FIND_INPUT_CLASS = "reader-finder-input";
export declare function isFindShortcut(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "key">): boolean;
export declare function useFindShortcut(onFind: () => void, target?: Window | null): void;
//# sourceMappingURL=use-find-shortcut.d.ts.map