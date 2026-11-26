/** 输入框那一行的 agent 设置（Thread 的 ComposerExtra 插槽）：都是 assistant-ui 的 ModelSelector（../ui/elements/model-selector.tsx）——
 * 模型是一个按钮（点开是带搜索、分组的列表），思考强度是旁边一排胶囊（ModelSelectorEffort，一点就切）；
 * 别的设置项（模式、快速……）收在「更多」里。
 * 数据是 ACP 的 configOptions（agent 开会话时给，见 ../acp/config.ts），agent 不给就什么都不画。
 */
import { type ReactElement } from "react";
import type { AskConfigOption } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
export type AskConfigState = {
    options: readonly AskConfigOption[];
    set: (configId: string, value: string | boolean) => void;
};
export declare const AskConfigContext: import("react").Context<AskConfigState>;
/** 设置项分三类：模型、思考强度、其余。 */
export declare function splitConfig(options: readonly AskConfigOption[]): {
    model: AskConfigOption;
    thought: AskConfigOption;
    rest: AskConfigOption[];
};
/** ModelSelector 要的模型列表：每个模型都带同一份思考强度档位（ACP 的思考强度是整个会话的，不分模型）。 */
export declare function toModelOptions(model: AskConfigOption, thought: AskConfigOption | null): ModelOption[];
/**
 * 思考强度的颜色：不认档位的值，只看它在 agent 给的列表里排第几（agent 按从弱到强排）。
 * 第一档是灰的；往后从绿（--ok）过渡到橙（--warn）再到红（--danger），agent 给几档就分几段。
 */
export declare function effortColor(index: number, count: number): string;
export declare function AskAgentSettings(): ReactElement | null;
