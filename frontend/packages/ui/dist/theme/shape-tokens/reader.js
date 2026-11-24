/**
 * 模块：reader（阅读器外围控件）。说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。
 *
 * 五个前缀：chrome（顶栏、托盘、下载、实时译文胶囊）、tab（顶栏页签和面板 dock 的页签）、hud（底部页码缩放条）、
 * float（右下工具球、目录/搜索卡、各类弹层、画笔条、待提交药丸）、sheet（PDF 页的纸张：描边、阴影、页间距、圆角、阅读区背景纹理）。
 * 不吃这些变量：PDF 页本身、译文叠层、悬停框和区域高亮、搜索高亮色、状态语义色、进度条、markdown 正文。
 * 每处写法：var(--reader-xxx, var(--shape-全局旋钮, 现在的值))。
 */
export const READER_SHAPE_TOKENS = [
    // —— chrome ——
    { name: "--reader-chrome-edge-width", kind: "length", description: "顶栏、托盘、下载按钮和菜单、目录搜索分组、实时译文胶囊的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--reader-chrome-edge-color", kind: "color", description: "同上这些的描边颜色", fallback: "var(--shape-edge-color, 墨色 7–9% 透明)" },
    { name: "--reader-chrome-shadow", kind: "shadow", description: "顶栏右上角的下载、关闭、面板按钮和实时译文胶囊的阴影（含悬停时）", fallback: "var(--shape-shadow-sm, 0 10px 28px 的淡阴影)" },
    { name: "--reader-chrome-bar-shadow", kind: "shadow", description: "顶栏整条的底部阴影", fallback: "0 1px 0 纸色 72% 透明" },
    { name: "--reader-chrome-radius", kind: "length", description: "托盘、下载/关闭按钮、工具球、画笔条、待提交药丸等胶囊的圆角", fallback: "var(--shape-radius-control, 999px)" },
    { name: "--reader-chrome-press-transform", kind: "transform", description: "顶栏按钮和实时译文胶囊按下时的位移", fallback: "var(--shape-press-transform, scale(0.97))" },
    { name: "--reader-chrome-press-shadow", kind: "shadow", description: "顶栏按钮按下时的阴影", fallback: "var(--shape-press-shadow, 和不按时一样)" },
    // —— tab ——
    { name: "--reader-tab-edge-width", kind: "length", description: "顶栏「原文 / 对照 / 译文」页签的描边粗细；分组外框也用它", fallback: "页签 0；分组外框 var(--shape-edge-width, 1px)" },
    { name: "--reader-tab-edge-color", kind: "color", description: "页签和分组外框的描边颜色", fallback: "页签透明；分组外框 var(--shape-edge-color, 墨色 7% 透明)" },
    { name: "--reader-tab-radius", kind: "length", description: "页签和分组外框的圆角", fallback: "var(--shape-radius-control, 999px)" },
    { name: "--reader-tab-active-shadow", kind: "shadow", description: "选中页签（顶栏、面板 dock）的阴影", fallback: "var(--shape-shadow-sm, 0 2px 7px 的淡阴影)" },
    { name: "--reader-tab-press-transform", kind: "transform", description: "页签按下时的位移", fallback: "var(--shape-press-transform, scale(0.97))" },
    // —— hud ——
    { name: "--reader-hud-edge-width", kind: "length", description: "底部页码缩放条的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--reader-hud-edge-color", kind: "color", description: "底部页码缩放条的描边颜色", fallback: "var(--shape-edge-color, 墨色 8% 透明)" },
    { name: "--reader-hud-shadow", kind: "shadow", description: "底部页码缩放条的阴影", fallback: "var(--shape-shadow-md, 0 10px 28px 的淡阴影)" },
    { name: "--reader-hud-radius", kind: "length", description: "底部页码缩放条的圆角", fallback: "var(--shape-radius-control, 999px)" },
    { name: "--reader-hud-key-radius", kind: "length", description: "底部条里页码、缩放、翻页小按钮的圆角", fallback: "var(--shape-radius-control, 999px)" },
    { name: "--reader-hud-press-transform", kind: "transform", description: "底部条小按钮按下时的位移", fallback: "var(--shape-press-transform, scale(0.96))" },
    // —— float ——
    { name: "--reader-float-edge-width", kind: "length", description: "目录/搜索卡、书签/待处理/版本弹层、画笔条、工具球小按钮、待提交药丸、Markdown 搜索条和大纲的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--reader-float-edge-color", kind: "color", description: "同上这些的描边颜色", fallback: "var(--shape-edge-color, 墨色 9–10% 透明)" },
    { name: "--reader-float-shadow", kind: "shadow", description: "工具球、画笔条、待提交药丸、编辑框、Markdown 搜索条的阴影", fallback: "var(--shape-shadow-md 或 sm, 各处现在的淡阴影)" },
    { name: "--reader-float-card-shadow", kind: "shadow", description: "目录/搜索卡、各类弹层、下载菜单、Markdown 大纲、浮层面的阴影", fallback: "var(--shape-shadow-md, 各处现在的淡阴影)" },
    { name: "--reader-float-radius", kind: "length", description: "目录/搜索卡、各类弹层、下载菜单、浮层面的圆角", fallback: "var(--shape-radius-surface, 12–18px)" },
    { name: "--reader-float-press-transform", kind: "transform", description: "工具球、浮层关闭钮按下时的位移", fallback: "var(--shape-press-transform, scale(0.94–0.95))" },
    { name: "--reader-float-press-shadow", kind: "shadow", description: "工具球按下时的阴影", fallback: "var(--shape-press-shadow, 和不按时一样)" },
    // —— sheet（PDF 页纸张；描边和阴影画在页槽外面，不改页槽尺寸，译文叠层对得齐）——
    { name: "--reader-sheet-border-width", kind: "length", description: "每页 PDF 的描边粗细（用 outline 画在页外，不占位）", fallback: "0" },
    { name: "--reader-sheet-border-color", kind: "color", description: "每页 PDF 的描边颜色", fallback: "transparent" },
    { name: "--reader-sheet-shadow", kind: "shadow", description: "每页 PDF 外面再加的一层阴影（页自带的淡阴影照旧）", fallback: "none" },
    { name: "--reader-sheet-gap", kind: "length", description: "PDF 页和页之间的间距", fallback: "12px" },
    { name: "--reader-sheet-radius", kind: "length", description: "每页 PDF 的圆角（页槽、页、画布一起圆）", fallback: "0" },
    { name: "--reader-sheet-backdrop", kind: "image", description: "阅读区（页与页之间）的背景纹理，写 url(...) 或渐变，叠在底色上；装饰包用", fallback: "none" },
];
//# sourceMappingURL=reader.js.map