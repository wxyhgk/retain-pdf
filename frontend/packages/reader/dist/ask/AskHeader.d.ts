import { type ReactElement } from "react";
import type { ReaderAskAgent, ReaderAskAnchor } from "../contracts/ask.js";
export type AskWindowMode = "float" | "dock" | "full";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export declare function shortAgentName(name: string): string;
export type AskHeaderProps = {
    anchor: ReaderAskAnchor;
    agents: readonly ReaderAskAgent[] | null;
    agentId: string;
    onAgent: (id: string) => void;
    mode: AskWindowMode;
    onMode: (mode: AskWindowMode) => void;
    onShowAnchor?: () => void;
    onDelete?: () => void;
    onClose: () => void;
};
export declare function AskHeader({ anchor, agents, agentId, onAgent, mode, onMode, onShowAnchor, onDelete, onClose }: AskHeaderProps): ReactElement;
//# sourceMappingURL=AskHeader.d.ts.map