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
    { name: "--dialog-title-font", kind: "font", description: "弹窗标题的字体", fallback: "var(--shape-heading-font, 继承正文)" },
    { name: "--dialog-title-weight", kind: "number", description: "弹窗标题字重", fallback: "var(--shape-heading-weight, 600)" },
    { name: "--dialog-divider-width", kind: "length", description: "弹窗内分隔线粗细：标题栏下、底栏上、设置和书籍详情的左栏", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--dialog-divider-color", kind: "color", description: "弹窗内分隔线颜色", fallback: "var(--shape-edge-color, var(--line))（书籍详情是 60% 的 --line）" },
    { name: "--dialog-nav-active-shadow", kind: "shadow", description: "设置弹窗左栏当前项的阴影", fallback: "var(--shape-shadow-sm, inset 0 0 0 1px var(--line), 0 1px 2px …)" },
    { name: "--dialog-card-border-width", kind: "length", description: "书籍详情左栏阅读卡的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--dialog-card-border-color", kind: "color", description: "书籍详情左栏阅读卡的描边颜色", fallback: "var(--shape-edge-color, 72% 的 --line)" },
    { name: "--dialog-card-radius", kind: "length", description: "书籍详情左栏阅读卡的圆角", fallback: "var(--shape-radius-surface, var(--ui-radius-lg))" },
    // —— 书籍详情、设置里的卡片和页签（--detail- 开头；大卡 card、小卡 tile 各一套） ——
    { name: "--detail-card-border-width", kind: "length", description: "大卡的描边粗细：详情概览卡、文件分组、进度卡、任务记录、危险区、左栏封面预览、设置启动区", fallback: "var(--shape-edge-width, 各处现在的值（多数 0，危险区和封面 1px）)" },
    { name: "--detail-card-border-color", kind: "color", description: "大卡的描边颜色", fallback: "var(--shape-edge-color, 各处现在的值（封面是 60% 的 --border）)" },
    { name: "--detail-card-shadow", kind: "shadow", description: "大卡的阴影", fallback: "var(--shape-shadow-md, 各处现在的值（多数 none，封面是软阴影）)" },
    { name: "--detail-card-radius", kind: "length", description: "大卡的圆角；进度页两张卡通过 --book-detail-processing-radius 吃到它", fallback: "var(--shape-radius-surface, 各处现在的值（16–24px）)" },
    { name: "--detail-tile-border-width", kind: "length", description: "小卡的描边粗细：概览信息格、快速下载框和按钮、导出设置选项、文件条目、设置里的主题卡", fallback: "var(--shape-edge-width, 各处现在的值（多数 1px，文件条目 0）)" },
    { name: "--detail-tile-border-color", kind: "color", description: "小卡的描边颜色（悬停时也落到它）", fallback: "var(--shape-edge-color, 各处现在的值（多为淡淡的 --line）)" },
    { name: "--detail-tile-active-border-color", kind: "color", description: "导出设置里选中那一项的描边颜色", fallback: "var(--shape-edge-color, color-mix(in srgb, var(--ink) 38%, var(--line)))" },
    { name: "--detail-tile-shadow", kind: "shadow", description: "小卡的阴影", fallback: "var(--shape-shadow-sm, 各处现在的值（多数 none，下载按钮是软阴影）)" },
    { name: "--detail-tile-radius", kind: "length", description: "小卡的圆角（快速下载按钮这种小件落到 --shape-radius-control）", fallback: "var(--shape-radius-surface, 各处现在的值（9–17px）)" },
    { name: "--detail-danger-border-color", kind: "color", description: "概览页底部危险区的描边颜色（想保留红色提示就单独设它）", fallback: "var(--shape-edge-color, color-mix(in srgb, var(--danger) 22%, var(--line)))" },
    { name: "--detail-note-radius", kind: "length", description: "详情里有淡底色的提示条、悬停行、原文框的圆角：质量警告、新版本提示、已改几段、术语警告", fallback: "var(--shape-radius-control, 各处现在的值（8px 或 var(--ui-radius-sm/md))）" },
    { name: "--detail-icon-radius", kind: "length", description: "详情里图标方块的圆角：概览信息格图标、活动时间线图标、文件分组和条目图标", fallback: "var(--shape-radius-control, 各处现在的值（11–17px）)" },
    { name: "--detail-tabs-border-width", kind: "length", description: "详情右栏页签条外框的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
    { name: "--detail-tabs-border-color", kind: "color", description: "详情右栏页签条外框的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
    { name: "--detail-tabs-radius", kind: "length", description: "详情右栏页签条外框的圆角", fallback: "var(--shape-radius-control, 11px)" },
    { name: "--detail-tab-radius", kind: "length", description: "详情右栏每个页签（含选中药丸）的圆角", fallback: "var(--shape-radius-control, 8px)" },
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