// 阅读页「深色文档」开关：PDF 页黑底白字。是全局偏好（不分书），存在本机。
// 外观见 styles/doc-theme.css；开关在底栏（ReaderZoomHud）和快捷键 D。

export type ReaderDocTheme = "light" | "dark";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const READER_DOC_THEME_STORAGE_KEY = "retainpdf:reader:doc-theme:v1";
/** 写在 <html> 上的属性：`data-reader-doc="dark"` 时 doc-theme.css 生效。 */
export const READER_DOC_THEME_ATTR = "data-reader-doc";

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadReaderDocTheme(storage: StorageLike | null = defaultStorage()): ReaderDocTheme {
  try {
    return storage?.getItem(READER_DOC_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveReaderDocTheme(theme: ReaderDocTheme, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(READER_DOC_THEME_STORAGE_KEY, theme);
  } catch {
    // 存不了（隐私模式、配额满）就只管这一次。
  }
}

export function applyReaderDocTheme(theme: ReaderDocTheme, root: HTMLElement | null = globalThis.document?.documentElement ?? null): void {
  if (!root) return;
  if (theme === "dark") root.setAttribute(READER_DOC_THEME_ATTR, "dark");
  else root.removeAttribute(READER_DOC_THEME_ATTR);
}
