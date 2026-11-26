import type { ReactElement } from "react";
import type { AskAgent, AskContext } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
export type AskWindowMode = "float" | "dock" | "full";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export declare function shortAgentName(name: string): string;
/** 选 agent：按钮上只有图标（悬停写名字），点开是带图标的列表（assistant-ui 的 ModelSelector，agent 多时能搜）。没装的灰着。 */
export declare function agentOptions(agents: readonly AskAgent[]): ModelOption[];
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
