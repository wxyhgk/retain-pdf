import type { ReactElement, ReactNode } from "react";
import type { AskAgent } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
import { type AskHeaderMenuItem } from "./head-menu.js";
export { shortAgentName } from "./agent-row.js";
export type AskWindowMode = "float" | "dock" | "full";
/** agent 列表换成 ModelSelector 的选项（没装的灰着）；留给宿主自己摆选择器用。 */
export declare function agentOptions(agents: readonly AskAgent[]): ModelOption[];
export type AskHeaderProps = {
    /** 左边的标题（阅读页：对话菜单）。 */
    title?: ReactNode;
    /** 右边多放的按钮（旧写法，宿主还能用；常用的不多，尽量放进 menu）。 */
    actions?: ReactNode;
    /** 「···」里的项（不常用的：记忆……）。 */
    menu?: readonly AskHeaderMenuItem[];
    mode: AskWindowMode;
    onMode: (mode: AskWindowMode) => void;
    onDelete?: () => void;
    onClose: () => void;
};
export declare function AskHeader({ title, actions, menu, mode, onMode, onDelete, onClose }: AskHeaderProps): ReactElement;
