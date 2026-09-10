import type { ReactElement } from "react";
export type ReaderAssistantPanel = "markdown" | "ai";
export type ReaderAssistantDockProps = {
    active: ReaderAssistantPanel | null;
    onSelect: (panel: ReaderAssistantPanel) => void;
    onClose: () => void;
};
/**
 * Markdown 和 AI 是阅读辅助工具，不参与 PDF 阅读模式的选择。
 * 关闭时只显示安静的右侧工具栏；打开后由 Dock 顶栏负责切换与关闭。
 */
export declare function ReaderAssistantDock({ active, onSelect, onClose, }: ReaderAssistantDockProps): ReactElement;
//# sourceMappingURL=ReaderAssistantDock.d.ts.map