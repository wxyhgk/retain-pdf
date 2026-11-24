import type { ShapeToken } from "./types.js";
/**
 * 模块：reader（阅读器外围控件）。说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。
 *
 * 四个前缀：chrome（顶栏、托盘、下载、实时译文胶囊）、tab（顶栏页签和面板 dock 的页签）、hud（底部页码缩放条）、
 * float（右下工具球、目录/搜索卡、各类弹层、画笔条、待提交药丸）。
 * 不吃这些变量：PDF 页本身、译文叠层、悬停框和区域高亮、搜索高亮色、状态语义色、进度条、markdown 正文。
 * 每处写法：var(--reader-xxx, var(--shape-全局旋钮, 现在的值))。
 */
export declare const READER_SHAPE_TOKENS: ShapeToken[];
//# sourceMappingURL=reader.d.ts.map