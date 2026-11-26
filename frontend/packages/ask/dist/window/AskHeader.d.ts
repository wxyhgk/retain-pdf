import type { ReactElement, ReactNode } from "react";
import type { AskAgent } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
export type AskWindowMode = "float" | "dock" | "full";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export declare function shortAgentName(name: string): string;
/** 选 agent：按钮上只有图标（悬停写名字），点开是带图标的列表（assistant-ui 的 ModelSelector，agent 多时能搜）。没装的灰着。 */
export declare function agentOptions(agents: readonly AskAgent[]): ModelOption[];
export type AskHeaderProps = {
    /** 左边的标题（主对话 / 副对话的面包屑）。 */
    title?: ReactNode;
    /** 右边多放的按钮（记忆、归档……）。 */
    actions?: ReactNode;
    agents: readonly AskAgent[] | null;
    agentId: string;
    onAgent: (id: string) => void;
    mode: AskWindowMode;
    onMode: (mode: AskWindowMode) => void;
    onDelete?: () => void;
    onClose: () => void;
};
export declare function AskHeader({ title, actions, agents, agentId, onAgent, mode, onMode, onDelete, onClose }: AskHeaderProps): ReactElement;
