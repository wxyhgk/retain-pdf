// 壳层（2026-11-28）：顶栏、底栏下午起都不占行，浮在书页区的顶上、底下（chrome.css、hud.css），提问窗贴右边时上下都不用让。
// 以前两条栏实占一行（54px、36px），这里给提问窗算让出多少（reader-shell-layout.test.mjs 对着 CSS）。
export const READER_DOCK_INSETS = { top: 0, bottom: 0 } as const;
