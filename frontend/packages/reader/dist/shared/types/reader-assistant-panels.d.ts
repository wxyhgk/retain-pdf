/** 辅助面板的 id 清单 —— **唯一真源**。
 *
 * 在这之前，「有哪些面板」这件事分散在 7 个文件、17 处：dock 的 tab 列表、宿主的
 * 面板壳、view-state 的校验、恢复上次面板的判断、适配器类型、适配器注册。
 *
 * 实测漏一处的后果，三个探针**全绿**（tsc 0 error，609 个测试全过）：
 *
 *     view-state 没登记            → 存了不恢复
 *     resolveInitial 没登记        → 重开阅读页丢面板
 *     宿主没给面板壳               → **tab 还在，点了什么都不显示**
 *
 * 第三个最糟：tab 由「适配器在不在」决定，壳由宿主另写一遍，两边没有任何强制
 * 关系。所以这里不是「再加一条断言」，是把那个关系变成类型上的必然 ——
 * 规格表用 `satisfies Record<ReaderHostPanelId, …>`，漏一个面板编译不过。
 *
 * ## 为什么批注 / AI 批注 / 摘录 现在也在这份清单里
 *
 * 它们原来只能从可拖动的圆钮（FAB）进，而 dock 一开，
 * `.is-assistant-open .reader-fab { opacity: 0; pointer-events: none }` 就把圆钮
 * 整个吃掉 —— 开着任何一个 dock 面板时，这三个面板加三路下载**全部进不去**，
 * 键盘也没有入口。两个启动器各管一半、都看不到全貌，本身就是「太乱」的成因。
 * 现在只有 dock 一个启动器，这份清单就是它的全部内容。
 *
 * 这个文件**没有任何依赖**（不碰 React、不碰 lucide、不碰适配器），因为
 * shared/state 的 view-state 也要用它 —— 带图标的完整规格在
 * components/react-pdf/reader-base-panels.ts。
 *
 * 2026-11-03 起只剩 Markdown：RetainPDF 自己的 AI（宿主槽位面板「AI」= agent 终端、画板）删了，产品里只留
 * Studio 的 AI。存着的旧面板 id（"terminal"）读回来不认，当没开（isReaderAssistantPanel）。
 */
/** 包自己渲染的面板。内容在包里，不需要宿主注入。 */
export declare const READER_BASE_PANEL_IDS: readonly ["markdown"];
export declare const READER_ASSISTANT_PANEL_IDS: readonly ["markdown"];
export type ReaderBasePanelId = (typeof READER_BASE_PANEL_IDS)[number];
export type ReaderAssistantPanel = ReaderBasePanelId;
export declare function isReaderAssistantPanel(value: unknown): value is ReaderAssistantPanel;
//# sourceMappingURL=reader-assistant-panels.d.ts.map