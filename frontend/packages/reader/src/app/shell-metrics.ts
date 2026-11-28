// 壳层的高（2026-11-28）：底栏实占一行，CSS 里是 --reader-bottombar-h（react-pdf.css）；顶栏 11-28 下午起不占行，
// 改成浮在书页区顶上的两颗胶囊，所以上面不用让。JS 要用的地方（提问窗贴右边时让出底栏）从这里拿；两边的数字由测试对着（reader-shell-layout.test.mjs）。
export const READER_BOTTOMBAR_HEIGHT = 36;
export const READER_DOCK_INSETS = { top: 0, bottom: READER_BOTTOMBAR_HEIGHT } as const;
