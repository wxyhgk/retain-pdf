// Cmd/Ctrl+F：打开书内搜索、光标放进去。浏览器自己的查找只找得到眼前几页（文字层只给眼前的页挂，
// 见 PdfPageSlot），所以先接住；光标已经在书内搜索框里时再按一次就不拦，交还浏览器。
import { useEffect } from "react";

/** 书内搜索框的类名（ReaderFinder 的 Input）。 */
export const READER_FIND_INPUT_CLASS = "reader-finder-input";

export function isFindShortcut(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "key">): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && `${event.key || ""}`.toLowerCase() === "f";
}

export function useFindShortcut(onFind: () => void, target: Window | null = typeof window === "undefined" ? null : window): void {
  useEffect(() => {
    if (!target) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFindShortcut(event)) return;
      const focused = target.document?.activeElement as HTMLElement | null;
      if (focused?.classList?.contains(READER_FIND_INPUT_CLASS)) return;
      event.preventDefault();
      onFind();
    };
    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, [onFind, target]);
}
