import { type ReactElement } from "react";
import type { AskAgent } from "../contract.js";
/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export declare function shortAgentName(name: string): string;
export type AskAgentsState = {
    agents: readonly AskAgent[];
    agentId: string;
    onAgent: (id: string) => void;
};
export declare const AskAgentsContext: import("react").Context<AskAgentsState>;
/** 弹层最上面一排：能用的点了就换（换 agent 会开新会话，主对话照旧接着），没装的写「要先装」、点了看安装命令。只有一个 agent 时不画。 */
export declare function AgentRow({ agents, agentId, onAgent }: AskAgentsState): ReactElement | null;
