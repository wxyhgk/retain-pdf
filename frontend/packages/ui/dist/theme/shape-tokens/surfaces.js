/**
 * 模块：surfaces（弹窗和浮层）。说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。
 *
 * 弹窗外壳在 web/src/styles/dialog-shell.css，设置和书籍详情的外壳在 pages/home/app-settings.css、
 * features/book-detail/ui/shell/BookDetailShell.css。弹窗圆角不接 --panel-radius（它默认 24px，接上会改现有弹窗）。
 * Tooltip 不吃描边阴影类的全局旋钮（只留圆角）。
 */
export const SURFACE_SHAPE_TOKENS = [
    // —— 弹窗外壳 ——
    { name: "--dialog-scrim", kind: "color", description: "弹窗背后的遮罩颜色（同时用于抽屉背板）", fallback: "color-mix(in srgb, var(--bg) 62%, transparent)" },
    { name: "--dialog-blur", kind: "length", description: "弹窗遮罩的背景模糊半径，0 即不模糊", fallback: "10px" },
    { name: "--dialog-radius", kind: "length", description: "弹窗外壳圆角（没设时还认旧变量 --app-dialog-radius）", fallback: "var(--app-dialog-radius, 28px)" },
    { name: "--dialog-border-width", kind: "length", description: "弹窗外壳描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--dialog-border-color", kind: "color", description: "弹窗外壳描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
    { name: "--dialog-shadow", kind: "shadow", description: "弹窗外壳阴影", fallback: "var(--shape-shadow-lg, 0 18px 48px color-mix(in srgb, var(--shadow-color) 22%, transparent))" },
    { name: "--dialog-title-size", kind: "length", description: "弹窗标题字号", fallback: "1.125rem" },
    { name: "--dialog-title-weight", kind: "number", description: "弹窗标题字重", fallback: "var(--shape-heading-weight, 600)" },
    { name: "--dialog-divider-width", kind: "length", description: "弹窗内分隔线粗细：标题栏下、底栏上、设置和书籍详情的左栏", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--dialog-divider-color", kind: "color", description: "弹窗内分隔线颜色", fallback: "var(--shape-edge-color, var(--line))（书籍详情是 60% 的 --line）" },
    { name: "--dialog-nav-active-shadow", kind: "shadow", description: "设置弹窗左栏当前项的阴影", fallback: "var(--shape-shadow-sm, inset 0 0 0 1px var(--line), 0 1px 2px …)" },
    { name: "--dialog-card-border-width", kind: "length", description: "书籍详情左栏阅读卡的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--dialog-card-border-color", kind: "color", description: "书籍详情左栏阅读卡的描边颜色", fallback: "var(--shape-edge-color, 72% 的 --line)" },
    { name: "--dialog-card-radius", kind: "length", description: "书籍详情左栏阅读卡的圆角", fallback: "var(--shape-radius-surface, var(--ui-radius-lg))" },
    // —— 浮层面（筛选菜单、下载进度 toast） ——
    { name: "--floating-border-width", kind: "length", description: "浮层面描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--floating-border-color", kind: "color", description: "浮层面描边颜色", fallback: "var(--shape-edge-color, 10% 的 --ink)" },
    { name: "--floating-radius", kind: "length", description: "浮层面圆角", fallback: "var(--shape-radius-surface, 18px)" },
    { name: "--floating-shadow", kind: "shadow", description: "浮层面阴影", fallback: "var(--shape-shadow-md, 0 16px 40px color-mix(in srgb, var(--shadow-color) 16%, transparent))" },
    { name: "--floating-blur", kind: "length", description: "浮层面的背景模糊半径，0 即不模糊", fallback: "18px" },
    // —— Tooltip、Toast ——
    { name: "--tooltip-radius", kind: "length", description: "Tooltip 圆角", fallback: "calc(var(--radius) - 2px)" },
    { name: "--toast-radius", kind: "length", description: "Sonner 消息条圆角", fallback: "var(--radius)" },
    { name: "--toast-title-weight", kind: "number", description: "下载进度 toast 的标题字重", fallback: "var(--shape-heading-weight, 700)" },
    { name: "--toast-track-radius", kind: "length", description: "下载进度 toast 进度条槽的圆角", fallback: "999px" },
];
//# sourceMappingURL=surfaces.js.map