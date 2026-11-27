// 三行壳层（2026-11-28）的两条栏有多高：CSS 里是 --reader-topbar-h / --reader-bottombar-h（layout.css），
// JS 要用的地方（提问窗贴右边时上下让出两条栏）从这里拿；两边的数字由测试对着（reader-shell-layout.test.mjs）。
export const READER_TOPBAR_HEIGHT = 54;
export const READER_BOTTOMBAR_HEIGHT = 36;
export const READER_DOCK_INSETS = { top: READER_TOPBAR_HEIGHT, bottom: READER_BOTTOMBAR_HEIGHT } as const;
