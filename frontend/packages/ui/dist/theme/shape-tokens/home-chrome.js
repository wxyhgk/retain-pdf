/**
 * 模块：home-chrome（首页框架）。说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。
 * CSS 在 web/src/app/home/shell/AppTopBar.css、AppBottomBar.css、features/library/ui/page/LibraryBatchToolbar.css、
 * styles/core/ambient-surface.css。fallback 写的是不设变量时 CSS 里实际用的值。
 */
export const HOME_CHROME_SHAPE_TOKENS = [
    // —— 顶栏「图书馆 / 合集」切换：外框 ——
    { name: "--topbar-tabs-bg", kind: "color", description: "顶栏切换外框的底色", fallback: "var(--paper)" },
    { name: "--topbar-tabs-radius", kind: "length", description: "顶栏切换外框圆角", fallback: "var(--shape-radius-control)，没设时 999px" },
    { name: "--topbar-tabs-border-width", kind: "length", description: "顶栏切换外框描边粗细", fallback: "var(--shape-edge-width)，没设时 1px" },
    { name: "--topbar-tabs-border-color", kind: "color", description: "顶栏切换外框描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line)" },
    { name: "--topbar-tabs-shadow", kind: "shadow", description: "顶栏切换外框阴影", fallback: "var(--shape-shadow-sm)，没设时 0 1px 3px 淡阴影" },
    { name: "--topbar-tabs-gap", kind: "length", description: "两个标签之间的间距", fallback: "3px" },
    { name: "--topbar-tabs-padding", kind: "length", description: "外框和标签之间的内边距", fallback: "4px" },
    // —— 顶栏标签 ——
    { name: "--topbar-tab-radius", kind: "length", description: "单个标签圆角", fallback: "var(--shape-radius-control)，没设时 var(--btn-radius)" },
    { name: "--topbar-tab-border-width", kind: "length", description: "标签描边粗细（默认没有描边）", fallback: "var(--shape-edge-width)，没设时 0" },
    { name: "--topbar-tab-border-color", kind: "color", description: "标签描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line)" },
    { name: "--topbar-tab-shadow", kind: "shadow", description: "标签阴影（默认没有）", fallback: "var(--shape-shadow-sm)，没设时 none" },
    { name: "--topbar-tab-weight", kind: "number", description: "标签字重", fallback: "600" },
    { name: "--topbar-tab-press-transform", kind: "transform", description: "标签按下时的位移", fallback: "var(--shape-press-transform)，没设时 scale(0.96)" },
    { name: "--topbar-tab-press-shadow", kind: "shadow", description: "标签按下时的阴影", fallback: "var(--shape-press-shadow)，没设时和不按时一样" },
    { name: "--topbar-tab-active-bg", kind: "color", description: "选中标签的底色", fallback: "var(--btn-primary-bg)" },
    { name: "--topbar-tab-active-fg", kind: "color", description: "选中标签的文字颜色", fallback: "var(--btn-primary-fg)" },
    { name: "--topbar-tab-active-border-color", kind: "color", description: "选中标签的描边颜色", fallback: "同未选中标签的描边颜色" },
    { name: "--topbar-tab-active-shadow", kind: "shadow", description: "选中标签的阴影", fallback: "同未选中标签的阴影" },
    // —— 底栏外壳 ——
    { name: "--bottombar-bg", kind: "color", description: "底栏外壳底色", fallback: "color-mix(var(--paper) 82%, transparent)" },
    { name: "--bottombar-radius", kind: "length", description: "底栏外壳圆角", fallback: "var(--shape-radius-control)，没设时 999px" },
    { name: "--bottombar-border-width", kind: "length", description: "底栏外壳描边粗细", fallback: "var(--shape-edge-width)，没设时 1px" },
    { name: "--bottombar-border-color", kind: "color", description: "底栏外壳描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line) 的 88%" },
    { name: "--bottombar-shadow", kind: "shadow", description: "底栏外壳阴影", fallback: "var(--shape-shadow-md)，没设时 0 18px 46px 淡阴影" },
    { name: "--bottombar-gap", kind: "length", description: "底栏里各按钮之间的间距", fallback: "8px（窄屏 6px）" },
    { name: "--bottombar-padding", kind: "length", description: "底栏外壳内边距", fallback: "8px（窄屏 7px）" },
    // —— 底栏图标按钮 ——
    { name: "--bottombar-icon-bg", kind: "color", description: "底栏图标按钮底色（设置、任务中心等）", fallback: "var(--paper)" },
    { name: "--bottombar-icon-fg", kind: "color", description: "底栏图标按钮图标颜色", fallback: "var(--ink)" },
    { name: "--bottombar-icon-radius", kind: "length", description: "底栏图标按钮圆角（要方形就设小值）", fallback: "var(--shape-radius-control)，没设时 var(--btn-radius)" },
    { name: "--bottombar-icon-border-width", kind: "length", description: "底栏图标按钮描边粗细", fallback: "var(--shape-edge-width)，没设时 1px" },
    { name: "--bottombar-icon-border-color", kind: "color", description: "底栏图标按钮描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line)" },
    { name: "--bottombar-icon-shadow", kind: "shadow", description: "底栏图标按钮阴影（默认没有）", fallback: "var(--shape-shadow-sm)，没设时 none" },
    { name: "--bottombar-icon-press-transform", kind: "transform", description: "底栏图标按钮按下时的位移", fallback: "var(--shape-press-transform)，没设时 scale(0.94)" },
    { name: "--bottombar-icon-press-shadow", kind: "shadow", description: "底栏图标按钮按下时的阴影", fallback: "var(--shape-press-shadow)，没设时和不按时一样" },
    // —— 底栏主按钮（添加 PDF 的加号）——
    { name: "--bottombar-primary-bg", kind: "color", description: "底栏加号按钮底色", fallback: "var(--btn-primary-bg)" },
    { name: "--bottombar-primary-fg", kind: "color", description: "底栏加号按钮图标颜色", fallback: "var(--btn-primary-fg)" },
    { name: "--bottombar-primary-border-color", kind: "color", description: "底栏加号按钮描边颜色", fallback: "var(--shape-edge-color)，没设时同底色" },
    { name: "--bottombar-primary-active-shadow", kind: "shadow", description: "添加弹窗打开时加号按钮的光圈", fallback: "0 0 0 3px var(--accent-weak)" },
    // —— 底栏文字按钮（右下悬浮的实心按钮，目前没有页面在用，皮肤里仍有样式）——
    { name: "--bottombar-action-primary-bg", kind: "color", description: "底栏文字主按钮底色", fallback: "var(--ink)" },
    { name: "--bottombar-action-primary-fg", kind: "color", description: "底栏文字主按钮文字颜色", fallback: "var(--paper)" },
    // —— 底栏搜索框 ——
    { name: "--bottombar-search-bg", kind: "color", description: "底栏搜索框底色", fallback: "color-mix(var(--bg) 86%, transparent)" },
    { name: "--bottombar-search-radius", kind: "length", description: "底栏搜索框圆角", fallback: "var(--shape-radius-control)，没设时 999px" },
    { name: "--bottombar-search-border-width", kind: "length", description: "底栏搜索框描边粗细（用内阴影画）", fallback: "var(--shape-edge-width)，没设时 1px" },
    { name: "--bottombar-search-border-color", kind: "color", description: "底栏搜索框描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line) 的 70%" },
    { name: "--bottombar-search-focus-width", kind: "length", description: "底栏搜索框聚焦时的描边粗细", fallback: "1.5px" },
    { name: "--bottombar-search-focus-color", kind: "color", description: "底栏搜索框聚焦时的描边颜色", fallback: "color-mix(var(--accent) 70%, transparent)" },
    // —— 书库标题行 ——
    { name: "--heading-font", kind: "font", description: "书库标题（「全部书库」）的字体", fallback: "inherit" },
    { name: "--heading-size", kind: "length", description: "书库标题字号", fallback: "15px（≥640px 为 16px）" },
    { name: "--heading-weight", kind: "number", description: "书库标题字重", fallback: "var(--shape-heading-weight)，没设时 600" },
    { name: "--heading-color", kind: "color", description: "书库标题颜色", fallback: "color-mix(var(--foreground) 90%, transparent)" },
    { name: "--heading-accent-width", kind: "length", description: "标题下方装饰短横的宽度（默认 0，不显示）", fallback: "0" },
    { name: "--heading-accent-height", kind: "length", description: "标题下方装饰短横的粗细（默认 0，不显示）", fallback: "0" },
    { name: "--heading-accent-color", kind: "color", description: "标题下方装饰短横的颜色", fallback: "transparent" },
    { name: "--heading-accent-offset", kind: "length", description: "装饰短横离标题行底边的距离，负数往下", fallback: "0" },
    // —— 数量框 ——
    { name: "--count-badge-bg", kind: "color", description: "书库数量框底色", fallback: "color-mix(var(--muted-surface) 45%, transparent)" },
    { name: "--count-badge-color", kind: "color", description: "书库数量框文字颜色", fallback: "color-mix(var(--muted) 70%, transparent)" },
    { name: "--count-badge-size", kind: "length", description: "书库数量框字号", fallback: "11px" },
    { name: "--count-badge-radius", kind: "length", description: "书库数量框圆角", fallback: "var(--shape-radius-control)，没设时胶囊（全圆）" },
    { name: "--count-badge-border-width", kind: "length", description: "书库数量框描边粗细（默认没有描边）", fallback: "var(--shape-edge-width)，没设时 0" },
    { name: "--count-badge-border-color", kind: "color", description: "书库数量框描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line)" },
    // —— 批量工具栏 ——
    { name: "--batchbar-bg", kind: "color", description: "批量工具栏底色", fallback: "color-mix(var(--paper) 82%, transparent)" },
    { name: "--batchbar-radius", kind: "length", description: "批量工具栏圆角", fallback: "var(--shape-radius-control)，没设时胶囊（全圆）" },
    { name: "--batchbar-border-width", kind: "length", description: "批量工具栏描边粗细", fallback: "var(--shape-edge-width)，没设时 1px" },
    { name: "--batchbar-border-color", kind: "color", description: "批量工具栏描边颜色", fallback: "var(--shape-edge-color)，没设时 var(--line) 淡化后的颜色" },
    { name: "--batchbar-shadow", kind: "shadow", description: "批量工具栏阴影", fallback: "var(--shape-shadow-md)，没设时 0 18px 46px 淡阴影" },
    // —— 纸台（首页内容区的大面板）。前四个已在 styles/themes/_component-defaults.css 里设了默认值 ——
    { name: "--stage-veil", kind: "length", description: "纸台不透明度（百分比，越大越实）", fallback: "88%" },
    { name: "--stage-width", kind: "length", description: "纸台宽度", fallback: "min(1120px, 100%)" },
    { name: "--stage-pad", kind: "length", description: "纸台内边距（可写四个值）", fallback: "10px 14px 0（窄屏 6px 8px 0）" },
    { name: "--stage-shadow", kind: "shadow", description: "纸台阴影", fallback: "极淡的顶部高光加 0 12px 32px 淡阴影" },
    { name: "--stage-radius", kind: "length", description: "纸台圆角（可写四个值，如 6px 6px 0 0）", fallback: "6px 6px 0 0" },
    { name: "--stage-border-width", kind: "length", description: "纸台描边粗细（默认没有描边）", fallback: "0" },
    { name: "--stage-border-color", kind: "color", description: "纸台描边颜色", fallback: "var(--line)" },
];
//# sourceMappingURL=home-chrome.js.map