import type { ReactElement } from "react";
import type { AskAgent, AskContext } from "../contract.js";
export type AskWindowMode = "float" | "dock" | "full";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export declare function shortAgentName(name: string): string;
export type AskHeaderProps = {
    context: AskContext;
    agents: readonly AskAgent[] | null;
    agentId: string;
    onAgent: (id: string) => void;
    mode: AskWindowMode;
    onMode: (mode: AskWindowMode) => void;
    onShowContext?: () => void;
    onDelete?: () => void;
    onClose: () => void;
};
export declare function AskHeader({ context, agents, agentId, onAgent, mode, onMode, onShowContext, onDelete, onClose }: AskHeaderProps): ReactElement;
