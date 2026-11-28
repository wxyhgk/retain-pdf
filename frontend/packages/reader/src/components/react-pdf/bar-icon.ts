// 顶栏、底栏所有图标一个尺寸、一种线宽（2026-11-28 用户：带字不带字、大小粗细不统一、图标不贴切——两条栏只用图标，名字在悬停里）。
// 用法：<Search {...BAR_ICON} aria-hidden />。▾ 这种小箭头用 BAR_CARET。
export const BAR_ICON = { size: 16, strokeWidth: 1.75 } as const;
export const BAR_CARET = { size: 12, strokeWidth: 1.75 } as const;
