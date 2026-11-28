/** dock 的 tab 清单 —— 阅读页**唯一**的面板启动器。
 *
 * ## 为什么这是纯函数，而不是 dock 组件里的一段 JSX
 *
 * 「每个面板都进得去」这件事必须能被测到，而测一段 JSX 要么起 DOM 要么对源码
 * 做正则 —— 后者在实现改个变量名之后照样绿。做成纯函数，门禁就能直接把
 * READER_ASSISTANT_PANEL_IDS 和这里返回的 id 集合对账。
 *
 */
import type { LucideIcon } from "lucide-react";
import type { ReaderAssistantPanel } from "../../shared/types/reader-assistant-panels.js";
import type { ReaderExtension } from "../../extensions/types.js";
export type ReaderDockTab = {
    id: ReaderAssistantPanel;
    label: string;
    short: string;
    Icon: LucideIcon;
    /** 没有任务时禁用并说明原因。 */
    needsJob: boolean;
};
/** 2026-11-27 起面板由扩展在定义里带（ReaderExtension.panels），按扩展顺序；以前是 reader-base-panels.ts 一张表。 */
export declare function readerDockTabs(extensions?: readonly ReaderExtension[]): readonly ReaderDockTab[];
//# sourceMappingURL=reader-dock-tabs.d.ts.map